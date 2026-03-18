function fn() {
  var config = {};
  config.baseUrl = karate.properties['BOOKING_API_URL'] || java.lang.System.getenv('BOOKING_API_URL') || 'http://localhost:8080';
  karate.log('baseUrl =', config.baseUrl);
  return config;
}
