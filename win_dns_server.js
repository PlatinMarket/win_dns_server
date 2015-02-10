
/** Depencies **/
var DnsCmd = global.requireCached(global.path('/rpc_modules/win_dns_server/dns_cmd.js'));

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
    if (error) return res.parseError(error.message);
    return res.json(zones);
  });
};

/**
  * Get Zone Info
  */
module.exports.read = function(req, res, next, args) {
  if (!req.body.hasOwnProperty('zone')) return res.parseError(global.error('Zone require', 400));
  var type = req.body.hasOwnProperty('type') ? req.body['type'].toUpperCase() : undefined;
  if (type && (Object.keys(DnsCmd.RecordTypes)).indexOf(req.body['type'].toUpperCase()) == -1) return res.parseError(global.error('Unsupported type \'' + type + '\'', 400));
  DnsCmd.Records(req.body['zone'], function(error, records){
    if (error) return res.parseError(error);
    if (type && records.hasOwnProperty(type.toLocaleLowerCase())) return res.json(records[type.toLocaleLowerCase()]);
    if (type && !records.hasOwnProperty(type.toLocaleLowerCase())) return res.parseError(global.error(type + ' record not found!', 404))
    return res.json(records);
  });
};

/**
  * Create New Zone
  */
module.exports.create = function(req, res, next, args) {
  if (!req.body.hasOwnProperty('zone')) return res.parseError(global.error('Zone require', 400));
  DnsCmd.Create(req.body['zone'], function(error, records){
    if (error) return res.parseError(error);
    return res.json(records);
  });
};

/**
  * Create New Zone Record
  */
module.exports.record_create = function(req, res, next, args) {
  if (!req.body.hasOwnProperty('zone')) return res.parseError(global.error('Zone require', 400));
  if (!req.body.hasOwnProperty('type')) return res.parseError(global.error('Type require', 400));

  var Record = DnsCmd.CreateRecord(req.body.type, req.body);
  if (Record instanceof Error) return res.parseError(Record);

  DnsCmd.RecordAdd(req.body['zone'], Record, function(error, result){
    if (error) return res.parseError(error);
    return res.json(Record);
  });
};

/**
  * Delete Zone
  */
module.exports.delete = function(req, res, next, args) {
  //res.status(200).end('Not Allowed');
  if (!req.body.hasOwnProperty('zone')) return res.parseError(global.error('Zone require', 400));
  DnsCmd.Delete(req.body['zone'], function(error, deleted){
    if (error) return res.parseError(Record);
    return res.json({deleted: deleted});
  });
};