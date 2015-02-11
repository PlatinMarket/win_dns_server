
var ipaddr = require('ipaddr.js');

/**
  * DnsCmd Controller Object
  */
function DnsCmd() {
  var dnscmd = "C:\\Windows\\System32\\dnscmd.exe",
      filter = ['TrustAnchors'];

  var STDERR = {
    "ZONE_EXISTS": "DNS_ERROR_ZONE_ALREADY_EXISTS",
    "NOT_FOUND": "DNS_ERROR_ZONE_DOES_NOT_EXIST",
    "INVALID_PARAMETER": "ERROR_INVALID_PARAMETER",
    "RECORD_EXISTS": "DNS_ERROR_RECORD_ALREADY_EXISTS",
    "CNAME_EXISTS": "DNS_ERROR_CNAME_COLLISION",
    "ONLY_ROOT": "DNS_ERROR_RECORD_ONLY_AT_ZONE_ROOT"
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
        if (stdout && stdout.indexOf(STDERR.NOT_FOUND) > 0) return callback(global.error("Zone '" + name + "' not found!", 404), null);
        if (stderr) return callback(new Error(stderr), undefined);
        if (error) return callback(error, undefined);

        stdout = stdout.toString().replace(";  Zone:   ", "$ORIGIN");
        stdout = stdout.toString().replace(/(.*TXT\t\t)(.*?\r\n)/gi, "$1\"$2").replace(/(.*TXT\t\t.*)(.*?\r\n)/gi, "$1\"$2");
        stdout = stdout.toString().replace(/\r\n/gi, "\n");
        return callback(undefined, global.requireCached(global.path('/rpc_modules/win_dns_server/zonefile.js')).parse(stdout));
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
        if (stdout && stdout.indexOf(STDERR.ZONE_EXISTS) > 0) return callback(global.error("Zone '" + name + "' already exists", 409), undefined);
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
        if (stdout && stdout.indexOf(STDERR.NOT_FOUND) > 0) return callback(global.error("Zone '" + name + "' not found!", 404), false);
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
    if (!type) return global.error("Record type required", 400);
    if (!data || typeof data != "object") return global.error("Record data required", 400);
    type = type.toUpperCase();
    if ((Object.keys(this.RecordTypes)).indexOf(type) == -1) return global.error("Type '" + type + "' not found", 404);
    var _Record = new this.RecordTypes[type]();
    for (var key in data) if (_Record.hasOwnProperty(key.toLowerCase())) _Record[key.toLowerCase()] = data[key.toLowerCase()];
    var _Result = _Record.validate();
    if (_Result === true) return _Record;
    _Result.code = 400;
    return _Result;
  };

  /**
    * Create Record for Read Only
    *
    * @param type string
    * @param data object
    * @return Error, object<Record>
    */
  this.RecordAdd = function(name, record, callback){
    var _dnsCmd = this;
    var args = (["/RecordAdd", name]).concat(record.toArgs());
    global.execute(dnscmd, args, {},
      function (error, stdout, stderr){
        if (stdout && stdout.indexOf(STDERR.NOT_FOUND) > 0) return callback(global.error("Zone '" + name + "' not found!", 404), false);
        if (stdout && stdout.indexOf(STDERR.INVALID_PARAMETER) > 0) return callback(global.error("Invalid parameter\r\ndnscmd.exe " + args.join(" "), 400), false);
        if (stdout && stdout.indexOf(STDERR.RECORD_EXISTS) > 0) return callback(global.error("Record already exists", 409), false);
        if (stdout && stdout.indexOf(STDERR.CNAME_EXISTS) > 0) return callback(global.error("CNAME '" + record.name + "' already exists", 409), false);
        if (stdout && stdout.indexOf(STDERR.ONLY_ROOT) > 0) return callback(global.error("Record '" + record.constructor.name + "' allow only root zone", 400), false);
        if (stderr) return callback(new Error(stderr + "\r\ndnscmd.exe " + args.join(" ")), false);
        if (error) return callback(new Error(error.message + "\r\ndnscmd.exe " + args.join(" ")), false);
        callback(undefined, true);
      }
    );
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
        if (!ValidateIPaddress(this.ip)) return new Error(this.constructor.name + " Record IPv4 Address(ip)" + (ValidateString(this.ip) ? " '" + this.ip + "' " : " ") + "not validated");
        if (!ValidateHostname(this.name) && this.name != "@") return new Error(this.constructor.name + " Record Name(name)" + (ValidateString(this.name) ? " '" + this.name + "' " : " ") + "not validated");
        if (this.ttl != null && !ValidateNumber(this.ttl, 0, 2147483647)) return new Error(this.constructor.name + " TimeToLive(ttl)" + (ValidateString(this.ttl) ? " '" + this.ttl + "' " : " ") + "not validated");
        if (ValidateNumber(this.ttl)) this.ttl = parseInt(this.ttl, 10); else this.ttl = null;
        return true;
      };
      this.toArgs = function(){
        var args = [this.name];
        if (this.ttl != null) args.push(this.ttl);
        args = args.concat([this.constructor.name, this.ip]);
        return args;
      };
    },
    "AAAA": function AAAA(){
      this.name = null;
      this.ip = null;
      this.ttl = null;
      this.validate = function(){
        if (!ValidateIPaddress(this.ip, true)) return new Error(this.constructor.name + " Record IPv6 Address(ip)" + (ValidateString(this.ip) ? " '" + this.ip + "' " : " ") + "not validated");
        if (!ValidateHostname(this.name) && this.name != "@") return new Error(this.constructor.name + " Record Name(name)" + (ValidateString(this.name) ? " '" + this.name + "' " : " ") + "not validated");
        if (this.ttl != null && !ValidateNumber(this.ttl, 0, 2147483647)) return new Error(this.constructor.name + " TimeToLive(ttl)" + (ValidateString(this.ttl) ? " '" + this.ttl + "' " : " ") + "not validated");
        if (ValidateNumber(this.ttl)) this.ttl = parseInt(this.ttl, 10); else this.ttl = null;
        return true;
      };
      this.toArgs = function(){
        var args = [this.name];
        if (this.ttl != null) args.push(this.ttl);
        args = args.concat([this.constructor.name, this.ip]);
        return args;
      };
    },
    "NS": function NS(){
      this.name = null;
      this.host = null;
      this.ttl = null;
      this.validate = function(){
        this.name = "@";
        if (!ValidateFQDN(this.host)) return new Error(this.constructor.name + " Record FQDN(host)" + (ValidateString(this.host) ? " '" + this.host + "' " : " ") + "not validated");
        if (this.ttl != null && !ValidateNumber(this.ttl, 0, 2147483647)) return new Error(this.constructor.name + " TimeToLive(ttl)" + (ValidateString(this.ttl) ? " '" + this.ttl + "' " : " ") + "not validated");
        if (ValidateNumber(this.ttl)) this.ttl = parseInt(this.ttl, 10); else this.ttl = null;
        return true;
      };
      this.toArgs = function(){
        var args = [this.name];
        if (this.ttl != null) args.push(this.ttl);
        args = args.concat([this.constructor.name, this.host]);
        return args;
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
        this.name = "@";
        if (!ValidateFQDN(this.rname)) return new Error(this.constructor.name + " Record FQDN(rname)" + (ValidateString(this.rname) ? " '" + this.rname + "' " : " ") + "not validated");
        if (!ValidateFQDN(this.mname)) return new Error(this.constructor.name + " Record FQDN(mname)" + (ValidateString(this.mname) ? " '" + this.mname + "' " : " ") + "not validated");
        if (!ValidateNumber(this.minimum, 0, 2147483647)) return new Error(this.constructor.name + " Record Minimum(minimum)" + (ValidateString(this.minimum) ? " '" + this.minimum + "' " : " ") + "not validated"); else this.minimum = parseInt(this.minimum, 10);
        if (!ValidateNumber(this.expire, 0, 2147483647)) return new Error(this.constructor.name + " Record Expire(expire)" + (ValidateString(this.expire) ? " '" + this.expire + "' " : " ") + "not validated"); else this.expire = parseInt(this.expire, 10);
        if (!ValidateNumber(this.retry, 0, 2147483647)) return new Error(this.constructor.name + " Record Retry(retry)" + (ValidateString(this.retry) ? " '" + this.retry + "' " : " ") + "not validated"); else this.retry = parseInt(this.retry, 10);
        if (!ValidateNumber(this.refresh, 0, 2147483647)) return new Error(this.constructor.name + " Record Refresh(refresh)" + (ValidateString(this.refresh) ? " '" + this.refresh + "' " : " ") + "not validated"); else this.refresh = parseInt(this.refresh, 10);
        if (!ValidateNumber(this.serial, 0, 2147483647)) return new Error(this.constructor.name + " Record Serial(serial)" + (ValidateString(this.serial) ? " '" + this.serial + "' " : " ") + "not validated"); else this.serial = parseInt(this.serial, 10);
        if (this.ttl != null && !ValidateNumber(this.ttl, 0, 2147483647)) return new Error(this.constructor.name + " TimeToLive(ttl)" + (ValidateString(this.ttl) ? " '" + this.ttl + "' " : " ") + "not validated");
        if (ValidateNumber(this.ttl)) this.ttl = parseInt(this.ttl, 10); else this.ttl = null;
        return true;
      };
      this.toArgs = function(){
        var args = [this.name];
        if (this.ttl != null) args.push(this.ttl);
        args = args.concat([this.constructor.name, this.rname, this.mname, this.serial, this.refresh, this.retry, this.expire, this.minimum]);
        return args;
      };
    },
    "MX": function MX(){
      this.name = null;
      this.preference = null;
      this.host = null;
      this.ttl = null;
      this.validate = function(){
        this.name = "@";
        if (!ValidateFQDN(this.host)) return new Error(this.constructor.name + " Record FQDN(host)" + (ValidateString(this.host) ? " '" + this.host + "' " : " ") + "not validated");
        if (!ValidateNumber(this.preference, 0, 65535)) return new Error(this.constructor.name + " Record Order(preference)" + (ValidateString(this.preference) ? " '" + this.preference + "' " : " ") + "not validated"); else this.preference = parseInt(this.preference, 10);
        if (this.ttl != null && !ValidateNumber(this.ttl, 0, 2147483647)) return new Error(this.constructor.name + " TimeToLive(ttl)" + (ValidateString(this.ttl) ? " '" + this.ttl + "' " : " ") + "not validated");
        if (ValidateNumber(this.ttl)) this.ttl = parseInt(this.ttl, 10); else this.ttl = null;
        return true;
      };
      this.toArgs = function(){
        var args = [this.name];
        if (this.ttl != null) args.push(this.ttl);
        args = args.concat([this.constructor.name, this.preference, this.host]);
        return args;
      };
    },
    "CNAME": function CNAME(){
      this.name = null;
      this.alias = null;
      this.ttl = null;
      this.validate = function(){
        if (!ValidateHostname(this.name) && this.name != "@") return new Error(this.constructor.name + " Record Name(name)" + (ValidateString(this.name) ? " '" + this.name + "' " : " ") + "not validated");
        if (!ValidateFQDN(this.alias)) return new Error(this.constructor.name + " Record FQDN(alias)" + (ValidateString(this.alias) ? " '" + this.alias + "' " : " ") + "not validated");
        if (this.ttl != null && !ValidateNumber(this.ttl, 0, 2147483647)) return new Error(this.constructor.name + " TimeToLive(ttl)" + (ValidateString(this.ttl) ? " '" + this.ttl + "' " : " ") + "not validated");
        if (ValidateNumber(this.ttl)) this.ttl = parseInt(this.ttl, 10); else this.ttl = null;
        return true;
      };
      this.toArgs = function(){
        var args = [this.name];
        if (this.ttl != null) args.push(this.ttl);
        args = args.concat([this.constructor.name, this.alias]);
        return args;
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
        if (!ValidateServicename(this.name)) return new Error(this.constructor.name + " Record Name(name)" + (ValidateString(this.name) ? " '" + this.name + "' " : " ") + "not validated");
        if (!ValidateFQDN(this.target) && this.target != "@") return new Error(this.constructor.name + " Record FQDN(target)" + (ValidateString(this.target) ? " '" + this.target + "' " : " ") + "not validated");
        if (!ValidateNumber(this.priority, 0, 65535)) return new Error(this.constructor.name + " Record Priority(priority)" + (ValidateString(this.priority) ? " '" + this.priority + "' " : " ") + "not validated"); else this.priority = parseInt(this.priority, 10);
        if (!ValidateNumber(this.weight, 0, 65535)) return new Error(this.constructor.name + " Record Weight(weight)" + (ValidateString(this.weight) ? " '" + this.weight + "' " : " ") + "not validated"); else this.weight = parseInt(this.weight, 10);
        if (!ValidateNumber(this.port, 1, 65535)) return new Error(this.constructor.name + " Record Port(port)" + (ValidateString(this.port) ? " '" + this.port + "' " : " ") + "not validated"); else this.port = parseInt(this.port, 10);
        if (this.ttl != null && !ValidateNumber(this.ttl, 0, 2147483647)) return new Error(this.constructor.name + " TimeToLive(ttl)" + (ValidateString(this.ttl) ? " '" + this.ttl + "' " : " ") + "not validated");
        if (ValidateNumber(this.ttl)) this.ttl = parseInt(this.ttl, 10); else this.ttl = null;
        return true;
      };
      this.toArgs = function(){
        var args = [this.name];
        if (this.ttl != null) args.push(this.ttl);
        args = args.concat([this.constructor.name, this.priority, this.weight, this.port, this.target]);
        return args;
      };
    },
    "TXT": function TXT(){
      this.name = null;
      this.txt = null;
      this.ttl = null;
      this.validate = function(){
        if (!ValidateHostname(this.name) && this.name != "@") return new Error(this.constructor.name + " Record Name(name)" + (ValidateString(this.name) ? " '" + this.name + "' " : " ") + "not validated");
        if (!ValidateString(this.txt)) return new Error(this.constructor.name + " Record Name(txt)" + (ValidateString(this.txt) ? " '" + this.txt + "' " : " ") + "not validated");
        if (this.ttl != null && !ValidateNumber(this.ttl, 0, 2147483647)) return new Error(this.constructor.name + " TimeToLive(ttl)" + (ValidateString(this.ttl) ? " '" + this.ttl + "' " : " ") + "not validated");
        if (ValidateNumber(this.ttl)) this.ttl = parseInt(this.ttl, 10); else this.ttl = null;
        return true;
      };
      this.toArgs = function(){
        var args = [this.name];
        if (this.ttl != null) args.push(this.ttl);
        args = args.concat([this.constructor.name, this.txt]);
        return args;
      };
    }
  };

  /** 
    * DNS Common Validation Methods
    * -----------------------------
    * IPv4 & IPv6 Validator
    */
  function ValidateIPaddress(ipaddress, v6flag) {
    if (!ValidateString(ipaddress)) return false;
    if (v6flag === true) return ipaddr.IPv6.isValid(ipaddress);
    return ipaddr.IPv4.isValid(ipaddress);
  }

  /** 
    * String IsNullOrWhiteSpace
    */
  function ValidateString(input) {
    if (typeof input != "string") return false;
    if (input == null) return false;
    return input.replace(/\s/g, '').length > 0;
  }

  /**
    * String Hostname
    */
  function ValidateHostname(input) {
    if (!ValidateString(input)) return false;
    return /^(([a-zA-Z0-9_]|[a-zA-Z0-9_][a-zA-Z0-9_\-]*[a-zA-Z0-9_])\.)*([A-Za-z0-9_]|[A-Za-z0-9_][A-Za-z0-9_\-]*[A-Za-z0-9_])$/.test(input);
  }

  /**
    * String Servicename _service._protocol
    */
  function ValidateServicename(input) {
    if (!ValidateString(input)) return false;
    return /^[_][A-Za-z0-9]+[A-Za-z0-9]\.[_][A-Za-z0-9]+[A-Za-z0-9]$/.test(input);
  }

  /**
    * String FQDN
    */
  function ValidateFQDN(input) {
    if (!ValidateString(input) || input == "@" || input.slice(-1) != ".") return false;
    input = input.slice(0, input.length - 1);
    return ValidateHostname(input);
  }

  /**
    * String Number
    */
  function ValidateNumber(input, min, max) {
    if (((!ValidateString(input) || !/^\d+$/.test(input)) && typeof input != "number") || isNaN(input)) return false;
    if (typeof min == "number") if (input < min) return false;
    if (typeof max == "number") if (input > max) return false;
    return true;
  }

}

/** Exports to Module **/
module.exports = new DnsCmd();