'use strict';

app.controller('MainCtrl', function ($scope, $http, $filter, $timeout) {
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

  var forEachItemInFile = function (fileObj, callbacks) {
    fileObj.apis.forEach(function(api) {
      if (callbacks.hasOwnProperty('api')) {
        callbacks.api(api);
      }
      api.operations.forEach(function (op) {
        if (callbacks.hasOwnProperty('operation')) {
          callbacks.operation(op);
        }
        op.parameters.forEach(function (param) {
          if (callbacks.hasOwnProperty('parameter')) {
            callbacks.parameter(param);
          }
        });
      });
    });
  };

  var importFileObject = function(fileObj) {
    console.log("importing");
    allTypes = {};

    angular.extend(allTypes,
      { 'void': { type: 'void' } },
      primitiveTypes,
      { 'File': { type: 'File' } }
    );

    //add model names to our allTypes list
    for (var model in fileObj.models) {
      allTypes[model] = {type: model};
    }

    //used for operation.type and parameter.type
    var replaceTypeAndFormatWithFriendlyType = function(obj) {

      var getFriendlyTypeAndDeleteOriginal = function(obj) {
        var newName = null;

        for (var name in allTypes) {
          if (allTypes[name].type == obj.type &&
            allTypes[name].format == obj.format) {
            newName = name;
            break;
          }
        }
        if (!newName) {
          console.log("hmm no match for " + obj.type);
        }
        delete(obj.type);
        delete(obj.format);

        return newName;
      };

      if (obj.hasOwnProperty('items')) {
        if (obj.items.hasOwnProperty('type')) {
          obj.__friendlyType = getFriendlyTypeAndDeleteOriginal(obj.items);
        } else {
          obj.__friendlyType = obj.items['$ref'];
        }
        obj.__array = true;
        delete(obj.type);
        delete(obj.items);
      } else {
        obj.__friendlyType = getFriendlyTypeAndDeleteOriginal(obj);
      }
    };



    //replace type and format with friendlyType
    forEachItemInFile(fileObj, {
      operation: replaceTypeAndFormatWithFriendlyType,
      parameter: replaceTypeAndFormatWithFriendlyType
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
    $scope.fileContents = JSON.stringify(fileObj, null, 2);

  };

  var cleanUpFileObject = function(originalFileObj) {
    var fileObj = angular.copy(originalFileObj);

    var paramTypeChanged = function(parameter) {
      if (['query', 'header', 'path'].indexOf(parameter.paramType) > -1) {
        parameter.allowMultiple = parameter.allowMultiple || false;
      } else {
        delete (parameter.allowMultiple);
      }

      if (parameter.paramType == 'path') {
        parameter.required = true;
      }
    };

    //trigger validations for each parameterType
    forEachItemInFile(fileObj, {
      parameter: paramTypeChanged
    });

    return fileObj;
  };



  var exportJSON = function(originalFileObj) {
    console.log("export");
    var fileObj = angular.copy(originalFileObj);

    var revertBackToTypeAndFormat = function(obj) {

      var setTypeAndFormat = function(obj, friendlyType) {
        obj.type = allTypes[friendlyType].type;
        if (allTypes[friendlyType].hasOwnProperty('format')) {
          obj.format = allTypes[friendlyType].format;
        }
      };

      if (obj.__friendlyType == 'void') {
        delete(obj.__array);
      }

      if (obj.hasOwnProperty('__friendlyType')) {
        if (obj.hasOwnProperty('__array') && obj['__array']) {
          obj.type = 'array';

          if (obj.__friendlyType[0] >= 'A' && obj.__friendlyType[0] <= 'Z') {
            obj.items = {'$ref': obj.__friendlyType};
          } else {
            obj.items = {};
            setTypeAndFormat(obj.items, obj.__friendlyType);
          }
          delete(obj.__array);
        } else {
          setTypeAndFormat(obj, obj.__friendlyType);
        }
        delete(obj.__friendlyType);
      } else {
        console.log("Something went wrong. Expected to find and replace __friendlyType.")
      }
    };

    //replace friendlyType with correct type && format
    forEachItemInFile(fileObj, {
      operation: revertBackToTypeAndFormat,
      parameter: revertBackToTypeAndFormat
    });

    $scope.fileContents = JSON.stringify(fileObj, null, 2);
  };

  //listen for changes from ng-model in the rows on the left panel of the view
  $scope.$watch('file', function(newValue) {
    if (newValue != null) {
      $scope.file = cleanUpFileObject(newValue);
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
