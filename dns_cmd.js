
/**
  * DnsCmd Controller Object
  */
function DnsCmd() {
  var dnscmd = "C:\\Windows\\System32\\dnscmd.exe",
      filter = ['TrustAnchors'];

  var STDERR = {
    "ZONE_EXISTS": "DNS_ERROR_ZONE_ALREADY_EXISTS",
    "NOT_FOUND": "DNS_ERROR_ZONE_DOES_NOT_EXIST"
  };

  /**
    * Test Case
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

  /**
    * Create Record for Read Only
    *
    * @param type string
    * @param data object
    * @return Error, object<Record>
    */
  this.CreateRecord = function(type, data){
    if (!type) return new Error("Record type required");
    if (!data || typeof data != "object") return new Error("Record data required");
    type = type.toUpperCase();
    if ((Object.keys(this.RecordTypes)).indexOf(type) == -1) return new Error("Type '" + type + "' not found");
    var _Record = new this.RecordTypes[type]();
    for (var key in data) if (_Record.hasOwnProperty(key.toLowerCase())) _Record[key.toLowerCase()] = data[key.toLowerCase()];
    var _Result = _Record.validate();
    if (_Result === true) return _Record;
    return _Result;
  };

  /**
    * DNS Record Type Object
    * contains min. required types and validations
    */
  this.RecordTypes = {
    "A": function A(){
      this.name = null;
      this.ip = null;
      this.ttl = null;
      this.validate = function(){
        if (!ValidateIPaddress(this.ip)) return new Error("A Record IPv4 Address " + (this.ip ? "'" + this.ip + "'" : "") + " not validated");
        if (!ValidateString(this.name)) return new Error("A Record Name " + (this.name ? "'" + this.name + "'" : "") + " not validated");
        if (ValidateString(this.ttl) && parseInt(this.ttl, 10).toString() === this.ttl) this.ttl = parseInt(this.ttl, 10);
        if (typeof this.ttl != "number") this.ttl = null;
        return true;
      };
    },
    "AAAA": function AAAA(){
      this.name = null;
      this.ip = null;
      this.ttl = null;
      this.validate = function(){
        return true;
      };
    },
    "NS": function NS(){
      this.name = null;
      this.host = null;
      this.ttl = null;
      this.validate = function(){
        return true;
      };
    },
    "SOA": function SOA(){
      this.name = null;
      this.minimum = null;
      this.expire = null;
      this.retry = null;
      this.refresh = null;
      this.serial = null;
      this.rname = null;
      this.mname = null;
      this.ttl = null;
      this.validate = function(){
        return true;
      };
    },
    "MX": function MX(){
      this.name = null;
      this.preference = null;
      this.host = null;
      this.ttl = null;
      this.validate = function(){
        return true;
      };
    },
    "CNAME": function CNAME(){
      this.name = null;
      this.alias = null;
      this.validate = function(){
        return true;
      };
    },
    "SRV": function SRV(){
      this.name = null;
      this.target = null;
      this.priority = null;
      this.weight = null;
      this.port = null;
      this.ttl = null;
      this.validate = function(){
        return true;
      };
    },
    "TXT": function TXT(){
      this.name = null;
      this.txt = null;
      this.ttl = null;
      this.validate = function(){
        return true;
      };
    }
  };

  /** Validation Helpers **/
  function ValidateIPaddress(ipaddress) {
    return /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ipaddress);
  }
  function ValidateString(input) {
    if (typeof input != "string") return false;
    if (input == null) return false;
    return input.replace(/\s/g, '').length > 0;
  }

}

/** Exports to Module **/
module.exports = new DnsCmd();