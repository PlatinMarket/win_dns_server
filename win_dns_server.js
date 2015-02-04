
module.exports.index = function(req, res, next, args) {
  global.db.server.find("servers", function(err, result){
    res.json(result);
  });
};

module.exports.sd = function(req, res, next, args) {
  var zonefile = require('dns-zonefile');
  var text = require('fs').readFileSync('./rpc_modules/win_dns_server/dns_out.txt', 'utf8');
  output = zonefile.parse(text);
  var a = 2;
  res.json(output);
};