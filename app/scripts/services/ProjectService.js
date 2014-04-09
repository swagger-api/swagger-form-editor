angular.module('swaggerEditorApp').factory('ProjectService', function (ProjectUtilities, $timeout) {

  var service = {
    doc: null,
    files: [],
    allTypes: {},
    remoteURL: "",

    //used for creating or renaming a model type, updating dropdown, and calling updateTypesInFile
    createNewType: function (fileObj, newName, originalName, deleteOriginal) {
      service.allTypes[newName] = {type: newName};
      if (deleteOriginal) {
        delete(service.allTypes[originalName]);
      }
      ProjectUtilities.generateTypesAsArray(service.allTypes);
      ProjectUtilities.updateTypesInFile(fileObj, newName, originalName);
    },

    importDocFromURL: function(url) {
      var s = new SwaggerApi(url);
      s.specFromURL(url, function(doc) {

        console.log("importing");
        console.log(doc);
        if (!doc.hasOwnProperty('apiDeclarations')) {
          alert("This does not appear to be a valid docs object");
          return;
        }

        service.allTypes = {};

        angular.extend(service.allTypes,
          { 'void': { type: 'void' } },
          ProjectUtilities.primitiveTypes,
          { 'File': { type: 'File' } }
        );

//        $scope.$apply(function() {
        $timeout(function() {
          doc.apiDeclarations.forEach(function (file, i) {
            doc.apiDeclarations[i] = service.importFileObject(file);

            //add model names to our allTypes list
            for (var modelName in file.models) {
              service.allTypes[modelName] = {type: modelName};
            }
          });
          service.doc = doc;
          service.files = service.doc.apiDeclarations;
          service.remoteURL = url;
          console.log("service doc");
          console.log(service.doc);
          //});
        }, 0);
      });
    },

    importFileObject: function(fileObj) {
      //used for operation.type and parameter.type
      var replaceTypeAndFormatWithFriendlyType = function(obj) {

        var getFriendlyTypeAndDeleteOriginal = function(obj) {
          var newName = null;

          for (var name in service.allTypes) {
            if (service.allTypes[name].type == obj.type &&
              service.allTypes[name].format == obj.format) {
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

        var originalType;

        if (obj.hasOwnProperty('items')) {
          if (obj.items.hasOwnProperty('type')) {
            originalType = obj.items.type;
            obj.__friendlyType = getFriendlyTypeAndDeleteOriginal(obj.items);
          } else {
            originalType = obj.items['$ref'];
            obj.__friendlyType = obj.items['$ref'];

            if (!service.allTypes.hasOwnProperty(obj.__friendlyType)) {
              obj.__friendlyType = null;
            }
          }
          obj.__array = true;
          delete(obj.type);
          delete(obj.items);
        } else if (obj.hasOwnProperty('$ref')) {
          originalType = obj['$ref'];
          obj.__friendlyType = obj['$ref'];
          if (!service.allTypes.hasOwnProperty(obj.__friendlyType)) {
            obj.__friendlyType = null;
          }
          delete(obj['$ref']);
        } else {
          originalType = obj.type;
          obj.__friendlyType = getFriendlyTypeAndDeleteOriginal(obj);
        }
//      console.log("originalType was " + originalType);
//      console.log("friendlyType is now " + obj.__friendlyType);
        if (obj.__friendlyType == null) {
          var newType = "Missing:" + originalType;
          obj.__friendlyType = newType;
          service.createNewType(fileObj, newType, originalType);
        }

      };



      //replace type and format with friendlyType
      ProjectUtilities.forEachItemInFile(fileObj, {
        operation: replaceTypeAndFormatWithFriendlyType,
        parameter: replaceTypeAndFormatWithFriendlyType
//      property: replaceTypeAndFormatWithFriendlyType
      });

      //replace type and format with friendlyType
      ProjectUtilities.forEachItemInFile(fileObj, {
        property: replaceTypeAndFormatWithFriendlyType
      });

      //add a __path to each operation object, __id to model, and __name to each property object
      ProjectUtilities.forEachItemInFile(fileObj, {
        operation: function(op, opIndex, ops, api) {
          op.__path = api.path;
        },
        model: function(model, modelName, models) {
          model.__id = model.id;
          var i = 1;
          for (var propertyName in model.properties) {
            model.properties[propertyName].__name = propertyName;
            model.properties[propertyName].__storedName = propertyName;
            model.properties[propertyName].__order = i++;
          }
        }
      });

      ProjectUtilities.generateTypesAsArray(service.allTypes);

      return fileObj;
    }

  };

  return service;
});