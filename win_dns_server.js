
var dnscmd = "C:\\Windows\\System32\\dnscmd.exe";

/**
  * List Of Dns Zones
  */
module.exports.index = function(req, res, next, args) {
  res.end('Dns Server Control');
};

module.exports.zones = function(req, res, next, args) {
  global.execute(dnscmd, ["/EnumZones"], {},
    function (error, stdout, stderr){
      if (error) return res.status(500).end(JSON.stringfy(error));
      return res.status(200).end(stdout);
    }
  );
};

module.exports.sd = function(req, res, next, args) {
  var zonefile = require('dns-zonefile');
  var text = require('fs').readFileSync(global.path('/rpc_modules/win_dns_server/dns_out.txt', 'utf8'));
  output = zonefile.parse(text.toString());
  res.json(output);
};
