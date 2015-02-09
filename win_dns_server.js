
/** Depencies **/
var DnsCmd = require(global.path('/rpc_modules/win_dns_server/dns_cmd.js'));

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
  if (!req.body.hasOwnProperty('zone')) return res.status(400).end('Zone require');
  var type = req.body.hasOwnProperty('type') ? req.body['type'].toUpperCase() : undefined;
  if (type && (Object.keys(DnsCmd.RecordTypes)).indexOf(req.body['type'].toUpperCase()) == -1) return res.status(400).end('Unsupported type \'' + type + '\'');
  DnsCmd.Records(req.body['zone'], function(error, records){
    if (error) return res.status(500).end(error.message);
    if (type && records.hasOwnProperty(type.toLocaleLowerCase())) return res.json(records[type.toLocaleLowerCase()]);
    if (type && !records.hasOwnProperty(type.toLocaleLowerCase())) return res.status(404).end(type + ' record not found!');
    return res.json(records);
  });
};

/**
  * Create New Zone
  */
module.exports.create = function(req, res, next, args) {
  if (!req.body.hasOwnProperty('zone')) return res.status(400).end('Zone require');
  DnsCmd.Create(req.body['zone'], function(error, records){
    if (error) return res.status(500).end(error.message);
    return res.json(records);
  });
};

/**
  * Create New Zone Record
  */
module.exports.record_add = function(req, res, next, args) {
  if (!req.body.hasOwnProperty('zone')) return res.status(400).end('Zone require');
  if (!req.body.hasOwnProperty('type')) return res.status(400).end('Type require');

  var Record = DnsCmd.CreateRecord(req.body.type, req.body);
  if (Record instanceof Error) return res.status(500).end(Record.message);

  return res.json(Record);
};

/**
  * Delete Zone
  */
module.exports.delete = function(req, res, next, args) {
  //res.status(200).end('Not Allowed');
  if (!req.body.hasOwnProperty('zone')) return res.status(400).end('Zone require');
  DnsCmd.Delete(req.body['zone'], function(error, deleted){
    if (error) return res.status(500).end(error.message);
    return res.json({deleted: deleted});
  });
};