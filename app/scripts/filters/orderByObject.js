app.filter('orderByObject', function() {
  return function(obj) {
    var array = [];
    Object.keys(obj).forEach(function(key) {
      array.push(obj[key]);
    });
    array.sort(function(a, b) {
      return a.__order - b.__order;
    });
    return array;
  }});