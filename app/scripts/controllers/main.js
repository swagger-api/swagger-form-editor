'use strict';

app.controller('MainCtrl', function ($scope, $http, $filter, $timeout) {
  $scope.items = ['/path1', '/path2'];
  $scope.file = null;
  $scope.fileContents = "";
  $http.get('/data/pet-data.json').success(function(obj) {
    importFileObject(obj);
  });

  $scope.methods = ['GET', 'PUT', 'POST', 'DELETE', 'PATCH', 'OPTIONS'];
  $scope.paramTypes = ['path', 'query', 'body', 'header', 'form'];

  var primitiveTypes = {
    'integer': {type: 'integer'},
    'integer [int32]': {type: 'integer', format: 'int32'},
    'integer [int64]': {type: 'integer', format: 'int64'},
    'number': {type: 'number'},
    'number [float]': {type: 'number', format: 'float'},
    'number [double]': {type: 'number', format: 'double'},
    'string': {type: 'string'},
    'string [byte]': {type: 'string', format: 'byte'},
    'boolean': {type: 'boolean'},
    'string [date]': {type: 'string', format: 'date'},
    'string [date-time]': {type: 'string', format: 'date-time'}
  };

  var allTypes = {};

  $scope.friendlyTypes = [];

  $scope.paramTypeChanged = function(parameter) {
    if (['query', 'header', 'path'].indexOf(parameter.paramType) > -1) {
      parameter.allowMultiple = parameter.allowMultiple || false;
    } else {
      delete (parameter.allowMultiple);
    }

    if (parameter.paramType == 'path') {
      parameter.required = true;
    }
  };

  var forEachParameterInFile = function (fileObj, callback) {
    fileObj.apis.forEach(function(api) {
      api.operations.forEach(function (op) {
        op.parameters.forEach(function (param) {
          callback(param);
        });
      });
    });
  };

  var importFileObject = function(fileObj) {
    allTypes = primitiveTypes;
    allTypes['File'] = {type: 'File'};
    //add model names to our allTypes list
    for (var model in fileObj.models) {
      allTypes[model] = {type: model};
    }

    //replace type and format with friendlyType
    forEachParameterInFile(fileObj, function(param) {
      var newName = null;
      for (var name in allTypes) {
        if (allTypes[name].type == param.type &&
          allTypes[name].format == param.format) {
          newName = name;
          break;
        }
      }
      if (!newName) {
        console.log("hmm no match for " + param.type);
      } else {
        param.__friendlyType = newName;
      }
      delete(param.type);
      delete(param.format);
    });

    //trigger validations for each parameterType
    forEachParameterInFile(fileObj, function(param) {
      $scope.paramTypeChanged(param);
    });


    //update human-readable types
    var friendlyTypes = [];
    for (var typeName in allTypes) {
      if (allTypes.hasOwnProperty(typeName)) {
        friendlyTypes.push(typeName);
      }
    }

    $scope.friendlyTypes = friendlyTypes;
    $scope.file = fileObj;
    $scope.fileContents = $filter('json')(fileObj);

  };

  var exportJSON = function(originalFileObj) {
    var fileObj = angular.copy(originalFileObj);

    //replace friendlyType with correct type && format
    forEachParameterInFile(fileObj, function(param) {
      if (param.hasOwnProperty('__friendlyType')) {
        param.type = allTypes[param.__friendlyType].type;
        if (allTypes[param.__friendlyType].hasOwnProperty('format')) {
          param.format = allTypes[param.__friendlyType].format;
        }
        delete(param.__friendlyType);
      } else {
        console.log("Something went wrong. Expected to find and replace __friendlyType.")
      }
    });
    $scope.fileContents = $filter('json')(fileObj);
  };

  //listen for changes from ng-model in the rows on the left panel of the view
  $scope.$watch('file', function(newValue) {
    if (newValue != null) {
      exportJSON(newValue);
    }
  }, true);


//  $timeout(function() {
//    window.swagger = new SwaggerApi({
//      url: "http://petstore.swagger.wordnik.com/api/api-docs",
//      success: function () {
//        if (swagger.ready === true) {
//          // upon connect, fetch a pet and set contents to element "mydata"
////          swagger.apis.pet.getPetById({petId: 1}, function (data) {
////            console.log(data.content.data);
////          });
//          console.log(swagger);
//        }
//      }
//    });
//  }, 1000);
});
