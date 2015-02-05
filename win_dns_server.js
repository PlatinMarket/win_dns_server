
/**
  * DnsCmd Execute File
  */
var dnscmd = "C:\\Windows\\System32\\dnscmd.exe";

/**
  * Service Status
  */
module.exports.index = function(req, res, next, args) {
  res.end('Dns Server Control');
};

/**
  * List Of Dns Zones
  */
module.exports.zones = function(req, res, next, args) {
  global.execute(dnscmd, ["/EnumZones"], {},
    function (error, stdout, stderr){
      if (error) return res.status(500).end(JSON.stringfy(error));
      var zones = stdout.toString().split("\r\n");
      
      var out = [];
      var start = 0;
      for (var i in zones) {
        if (i > 2 && zones[i].slice(0, 1) == " " && zones[i - (start + 3)].trim().slice(0, 9) == "Zone name") {
          start = start + 1;
          out.push(zones[i]);
        }
      }
      return res.status(200).end(out.join("\r\n"));
    }
  );
};

module.exports.sd = function(req, res, next, args) {
  var zonefile = require('dns-zonefile');
  var text = require('fs').readFileSync(global.path('/rpc_modules/win_dns_server/dns_out.txt', 'utf8'));
  output = zonefile.parse(text.toString());
  res.json(output);
};
