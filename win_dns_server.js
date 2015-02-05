
/**
  * DnsCmd Execute File
  */
var dnscmd = "C:\\Windows\\System32\\dnscmd.exe",
    dnsoutFolder = "C:\\Windows\\System32\\dns\\dns-out.txt",
    notFound = "DNS_ERROR_ZONE_DOES_NOT_EXIST";

/**
  * Check Dns Service Command
  */
module.exports._before = function(req, res, next, args) {
  //if (!require('fs').existsSync(dnscmd)) return res.status(500).end("dnscmd.exe not found!");
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
      stdout = stdout.toString().replace(/\r\n\t\t/gi, "\r\n@");
      stdout = stdout.toString().replace(";  Zone:   ", "$ORIGIN");
      stdout = stdout.toString().replace(/\r\n;/gi, ".\r\n;");
      stdout = stdout.toString().replace(/(.*TXT\t\t)(.*?\r\n)/gi, "$1\"|$2").replace(/(.*TXT\t\t.*)(.*?\r\n)/gi, "$1\"$2");
      stdout = stdout.toString().replace(/\r\n/gi, "\n");
      return res.json(require(global.path('/rpc_modules/win_dns_server/zonefile.js')).parse(stdout));
    }
  );
};
