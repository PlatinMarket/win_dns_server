
var types = ['SOA', 'MX', 'A', 'AAAA', 'TXT', 'SRV', 'CNAME'];

/**
  * DnsCmd Controller
  */
var DnsCmd = new (function DnsCmd(){
  var dnscmd = "C:\\Windows\\System32\\dnscmd.exe",
      filter = ['TrustAnchors'];

  var STDERR = {
    "ZONE_EXISTS": "DNS_ERROR_ZONE_ALREADY_EXISTS",
    "NOT_FOUND": "DNS_ERROR_ZONE_DOES_NOT_EXIST"
  };

  /**
    * Test Whole Object
    */
  this.Test = function(callback){
    if (!require('fs').existsSync(dnscmd)) return callback(new Error("Executer (dnscmd.exe) not found!"));
    return callback(true);
  };

  /**
    * List Of Zones
    *
    * @return Error, array<ZoneName>
    */    
  this.Zones = function (callback){
    global.execute(dnscmd, ["/EnumZones"], {},
      function (error, stdout, stderr){
        if (error) return callback(error, undefined);

        var zones = stdout.toString().split("\r\n"),
            out = [],
            up_shift = 0;

        for (var i in zones) {
          if (i > 2 && zones[i].slice(0, 1) == " " && zones[i - (up_shift + 3)].trim().slice(0, 9) == "Zone name") {
            up_shift = up_shift + 1;
            out.push(zones[i].trim().replace(/ .*/gi, ""));
          }
        }

        out = global.underscore.filter(out, function(zone) { return filter.indexOf(zone) === -1; });

        callback(undefined, out);
      }
    );
  };

  /**
    * Check Zone Exists
    *
    * @param name string
    * @param callback function
    * @return Error, bool
    */
  this.Exists = function(name, callback) {
    this.Records(name, function(error, zone){
      if (error) return callback(error, undefined);
      if (zone == null) return callback(undefined, false);
      callback(undefined, true);
    });
  };

  /**
    * Get Zone Records
    *
    * @param name string
    * @param callback function
    * @return Error, object<Zone>
    */
  this.Records = function(name, callback) {
    global.execute(dnscmd, ["/ZonePrint", name], {},
      function (error, stdout, stderr){
        if (stdout && stdout.indexOf(STDERR.NOT_FOUND) > 0) return callback(new Error("Zone '" + name + "' not found!"), null);
        if (stderr) return callback(new Error(stderr), undefined);
        if (error) return callback(error, undefined);

        stdout = stdout.toString().replace(/\r\n\t\t/gi, "\r\n@");
        stdout = stdout.toString().replace(";  Zone:   ", "$ORIGIN");
        stdout = stdout.toString().replace(/\r\n;/gi, ".\r\n;");
        stdout = stdout.toString().replace(/(.*TXT\t\t)(.*?\r\n)/gi, "$1\"$2").replace(/(.*TXT\t\t.*)(.*?\r\n)/gi, "$1\"$2");
        stdout = stdout.toString().replace(/\r\n/gi, "\n");
        return callback(undefined, require(global.path('/rpc_modules/win_dns_server/zonefile.js')).parse(stdout));
      }
    );
  };

  /**
    * Create New Zone
    *
    * @param name string
    * @param callback function
    * @return Error, object<Zone>
    */
  this.Create = function(name, callback){
    var _dnsCmd = this;
    global.execute(dnscmd, ["/ZoneAdd", name, "/Primary"], {},
      function (error, stdout, stderr){
        if (stdout && stdout.indexOf(STDERR.ZONE_EXISTS) > 0) return callback(new Error("Zone '" + name + "' already exists"), undefined);
        if (stderr) return callback(new Error(stderr), undefined);
        if (error) return callback(error, undefined);

        _dnsCmd.Records(name, callback);
      }
    );
  };

  /**
    * Delete Zone
    *
    * @param name string
    * @param callback function
    * @return Error, object<Zone>
    */
  this.Delete = function(name, callback){
    var _dnsCmd = this;
    global.execute(dnscmd, ["/ZoneDelete", name, "/f"], {},
      function (error, stdout, stderr){
        if (stdout && stdout.indexOf(STDERR.NOT_FOUND) > 0) return callback(new Error("Zone '" + name + "' not found!"), false);
        if (stderr) return callback(new Error(stderr), false);
        if (error) return callback(error, false);
        callback(undefined, true);
      }
    );
  };

});

/**
  * Check Dns Service Command
  */
module.exports._before = function(req, res, next, args) {
  DnsCmd.Test(function(error){
    if (error instanceof Error) return res.status(500).end(error.message);
    next();
  });
};

/**
  * List Of Dns Zones
  */
module.exports.index = function(req, res, next, args) {
  DnsCmd.Zones(function(error, zones){
    if (error) return res.status(500).end(error.message);
    return res.json(zones);
  });
};

/**
  * Get Zone Info
  */
module.exports.read = function(req, res, next, args) {
  if (!req.body.hasOwnProperty('zone')) return res.status(400).end('Zone excepted');
  var type = req.body.hasOwnProperty('type') ? req.body['type'].toUpperCase() : undefined;
  if (type && types.indexOf(req.body['type'].toUpperCase()) == -1) return res.status(400).end('Unsupported type \'' + type + '\'');
  DnsCmd.Records(req.body['zone'], function(error, records){
    if (error) return res.status(500).end(error.message);
    if (type && records.hasOwnProperty(type.toLocaleLowerCase())) return records[type.toLocaleLowerCase()];
    if (type && !records.hasOwnProperty(type.toLocaleLowerCase())) return res.status(404).end(type + ' record not found!');
    return res.json(records);
  });
};

/**
  * Create Zone New Zone
  */
module.exports.create = function(req, res, next, args) {
  if (!req.body.hasOwnProperty('zone')) return res.status(400).end('Zone excepted');
  DnsCmd.Create(req.body['zone'], function(error, records){
    if (error) return res.status(500).end(error.message);
    return res.json(records);
  });
};

/**
  * Delete Zone
  */
module.exports.delete = function(req, res, next, args) {
  if (!req.body.hasOwnProperty('zone')) return res.status(400).end('Zone excepted');
  DnsCmd.Delete(req.body['zone'], function(error, deleted){
    if (error) return res.status(500).end(error.message);
    return res.json({deleted: deleted});
  });
};