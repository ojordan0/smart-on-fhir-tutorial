(function(window){
  window.extractData = function() {
    var ret = $.Deferred();

    function onError() {
      console.log('Loading error', arguments);
      ret.reject();
    } 

    function onReady(smart)  {
      if (smart.hasOwnProperty('patient')) {
        var patient = smart.patient;
        var pt = patient.read();
        var obv = smart.patient.api.fetchAll({
                    type: 'Observation',
                    query: {
                      code: {
                        $or: ['http://loinc.org|8302-2', 'http://loinc.org|8462-4',
                              'http://loinc.org|8480-6', 'http://loinc.org|2085-9',
                              'http://loinc.org|2089-1', 'http://loinc.org|55284-4']
                      }
                    }
                  });
        
        // Search for the current patient's conditions
        var conds = smart.patient.api.search({
                          type: 'Condition'
                        });
   
        // Search for the current patient's prescriptions
        var meds = smart.patient.api.search({
                          type: 'MedicationOrder'
                        });

        $.when(pt, obv, conds, meds).fail(onError);

        $.when(pt, obv, conds, meds).done(function(patient, obv, conditions, medications) {
          //console.log(conditions); 
          console.log(medications); 
          var byCodes = smart.byCodes(obv, 'code');
          var gender = patient.gender;
          var dob = new Date(patient.birthDate);
          var day = dob.getDate();
          var monthIndex = dob.getMonth() + 1;
          var year = dob.getFullYear();
          var dobStr = monthIndex + '/' + day + '/' + year;
          var fname = '';
          var lname = '';

          if (typeof patient.name[0] !== 'undefined') {
            fname = patient.name[0].given.join(' ');
            lname = patient.name[0].family.join(' ');
          }

          var height = byCodes('8302-2');
          var systolicbp = getBloodPressureValue(byCodes('55284-4'),'8480-6');
          var diastolicbp = getBloodPressureValue(byCodes('55284-4'),'8462-4');
          var hdl = byCodes('2085-9');
          var ldl = byCodes('2089-1');
          
          var pConditions = [];
          if (conditions.data.total > 0) {
            if (typeof conditions.data.entry.length !== 'undefined') {
              console.log("- conditions total: " + conditions.data.total); 
              var conditionEntries = conditions.data.entry;
              for (var i = 0; i < conditionEntries.length; i++) {
                  pConditions[i] = "Condition: " + ' ' + conditionEntries[i].resource.code.text + '.  ' + "Date Recorded" + ' ' +  conditionEntries[i].resource.onsetDateTime + '';
               }
            }
          }
          
          var pMedications = [];
          if (medications.data.total > 0) {
            if (typeof medications.data.entry.length !== 'undefined') {
              console.log("- medications total: " + medications.data.total); 
              var conditionEntries = conditions.data.entry;
              for (var i = 0; i < conditionEntries.length; i++) {
                  pMedications[i] = "Medication: " + ' ' + conditionEntries[i].resource.medicationCodeableConcept.text + '.  ' + "Date Written" + ' ' +  conditionEntries[i].resource.dateWritten + '';
               }
            }
          }
         
          var p = defaultPatient();
          p.birthdate = dobStr;
          p.gender = gender;
          p.fname = fname;
          p.lname = lname;
          p.age = parseInt(calculateAge(dob));
          p.height = getQuantityValueAndUnit(height[0]);
          p.conditions = pConditions;
          p.medications = medications;

          if (typeof systolicbp != 'undefined')  {
            p.systolicbp = systolicbp;
          }

          if (typeof diastolicbp != 'undefined') {
            p.diastolicbp = diastolicbp;
          }

          p.hdl = getQuantityValueAndUnit(hdl[0]);
          p.ldl = getQuantityValueAndUnit(ldl[0]);

          ret.resolve(p);
        });
      } else {
        onError();
      }
    }

    FHIR.oauth2.ready(onReady, onError);
    return ret.promise();

  };

  function defaultPatient(){
    return {
      fname: {value: ''},
      lname: {value: ''},
      gender: {value: ''},
      birthdate: {value: ''},
      age: {value: ''},
      height: {value: ''},
      systolicbp: {value: ''},
      diastolicbp: {value: ''},
      ldl: {value: ''},
      hdl: {value: ''},
      conditions: {value: []},
      medications: {value: []},
    };
  }

  function getBloodPressureValue(BPObservations, typeOfPressure) {
    var formattedBPObservations = [];
    BPObservations.forEach(function(observation){
      var BP = observation.component.find(function(component){
        return component.code.coding.find(function(coding) {
          return coding.code == typeOfPressure;
        });
      });
      if (BP) {
        observation.valueQuantity = BP.valueQuantity;
        formattedBPObservations.push(observation);
      }
    });

    return getQuantityValueAndUnit(formattedBPObservations[0]);
  }

  function isLeapYear(year) {
    return new Date(year, 1, 29).getMonth() === 1;
  }

  function calculateAge(date) {
    if (Object.prototype.toString.call(date) === '[object Date]' && !isNaN(date.getTime())) {
      var d = new Date(date), now = new Date();
      var years = now.getFullYear() - d.getFullYear();
      d.setFullYear(d.getFullYear() + years);
      if (d > now) {
        years--;
        d.setFullYear(d.getFullYear() - 1);
      }
      var days = (now.getTime() - d.getTime()) / (3600 * 24 * 1000);
      return years + days / (isLeapYear(now.getFullYear()) ? 366 : 365);
    }
    else {
      return undefined;
    }
  }

  function getQuantityValueAndUnit(ob) {
    if (typeof ob != 'undefined' &&
        typeof ob.valueQuantity != 'undefined' &&
        typeof ob.valueQuantity.value != 'undefined' &&
        typeof ob.valueQuantity.unit != 'undefined') {
          return ob.valueQuantity.value + ' ' + ob.valueQuantity.unit;
    } else {
      return undefined;
    }
  }
  
  function getListHtmlContent(condArray) {
    var htmlContent = '<ul>';
    for (var i = 0; i < condArray.length; i++) {
        htmlContent += "<li>" + condArray[i] + '</li>';
     }
    htmlContent += '</ul>';
    return htmlContent;
  }
  
  window.drawVisualization = function(p) {
    $('#holder').show();
    $('#loading').hide();
    $('#fname').html(p.fname);
    $('#lname').html(p.lname);
    $('#gender').html(p.gender);
    $('#birthdate').html(p.birthdate);
    $('#age').html(p.age);
    $('#height').html(p.height);
    $('#systolicbp').html(p.systolicbp);
    $('#diastolicbp').html(p.diastolicbp);
    $('#ldl').html(p.ldl);
    $('#hdl').html(p.hdl); 
    if (p.conditions.length > 0) {
      var conditionsHtml = getListHtmlContent(p.conditions);
      $('#condics').html(conditionsHtml);
    } else {
      $('#condics').html("This patients do not have any documented Conditions.");
    }
    if (p.medications.length > 0) {
      var medicationsHtml = getListHtmlContent(p.medications);
      $('#medics').html(medicationsHtml);
    } else {
      $('#medics').html("This patients do not have any documented Medication Orders.");
    }
    
  };
 
})(window);
