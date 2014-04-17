app.filter('recentDate', function($filter) {
  return function(timestamp) {
    timestamp = timestamp;
    var today = new Date();

    if (new Date(timestamp).toDateString() == today.toDateString()) {
      return "Today";
    } else {
      var yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      if (new Date(timestamp).toDateString() == yesterday.toDateString()) {
        return "Yesterday";
      } else {
        return $filter('date')(timestamp, 'MMM d');
      }
    }
  }
});