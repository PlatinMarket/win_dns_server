
/**
  * DnsCmd Execute File
  */
var dnscmd = "C:\\Windows\\System32\\dnscmd.exe",
    notFound = "DNS_ERROR_ZONE_DOES_NOT_EXIST";

/**
  * Check Dns Service Command
  */
module.exports._before = function(req, res, next, args) {
  if (!require('fs').existsSync(dnscmd)) return res.status(500).end("dnscmd.exe not found!");
  next();
};

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
      
      var zones = stdout.toString().split("\r\n"),
          out = [],
          up_shift = 0;

      for (var i in zones) {
        if (i > 2 && zones[i].slice(0, 1) == " " && zones[i - (up_shift + 3)].trim().slice(0, 9) == "Zone name") {
          up_shift = up_shift + 1;
          out.push(zones[i].trim().replace(/ .*/gi, ""));
        }
      }

      return res.json(out);
    }
  );
};

/**
  * Get Zone Info
  */
module.exports.zone = function(req, res, next, args) {
  if (!req.body.hasOwnProperty('zone')) return res.status(400).end('zone excepted');
  global.execute(dnscmd, ["/ZonePrint", req.body['zone']], {},
    function (error, stdout, stderr){
      if (error) return res.status(500).end(JSON.stringfy(error));
      if (stderr || stdout.indexOf(notFound) > 0) return res.status(404).end('Zone not found!');
      return res.json(require('dns-zonefile').parse(stdout.toString()));
    }
  );
};

module.exports.sd = function(req, res, next, args) {
  var zonefile = require('dns-zonefile');
  var text = require('fs').readFileSync(global.path('/rpc_modules/win_dns_server/dns_out.txt', 'utf8'));
  output = zonefile.parse(text.toString());
  res.json(output);
};
