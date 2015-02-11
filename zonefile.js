(function () {
    var fs = require('fs');
    var pathJoin = require('path').join;
    var generate = function (options, template) {
        template = template || fs.readFileSync(pathJoin(__dirname, 'zonefile_template'), 'utf8');
        template = process$ORIGIN(options['$origin'], template);
        template = process$TTL(options['$ttl'], template);
        template = processSOA(options['soa'], template);
        template = processNS(options['ns'], template);
        template = processA(options['a'], template);
        template = processAAAA(options['aaaa'], template);
        template = processCNAME(options['cname'], template);
        template = processMX(options['mx'], template);
        template = processPTR(options['ptr'], template);
        template = processTXT(options['txt'], template);
        template = processSRV(options['srv'], template);
        template = processValues(options, template);
        return template.replace(/\n{2,}/gim, '\n\n');
    };

    var process$ORIGIN = function (data, template) {
        var ret = '';
        if (typeof data !== 'undefined') {
            ret += '$ORIGIN ' + data;
        }
        return template.replace('{$origin}', ret);
    };

    var process$TTL = function (data, template) {
        var ret = '';
        if (typeof data !== 'undefined') {
            ret += '$TTL ' + data;
        }
        return template.replace('{$ttl}', ret);
    };

    var processSOA = function (data, template) {
        var ret = template;
        data.name = data.name || '@';
        data.ttl = data.ttl || '';
        for (var key in data) {
            var value = data[key];
            ret = ret.replace('{' + key + '}', value + '\t');
        }
        return ret;
    };

    var processNS = function (data, template) {
        var ret = '';
        for (var i in data) {
            ret += (data[i].name || '@') + '\t';
            if(data[i].ttl) ret += data[i].ttl + '\t';
            ret += 'IN\tNS\t' + data[i].host + '\n';
        }
        return template.replace('{ns}', ret);
    };

    var processA = function (data, template) {
        var ret = '';
        for (var i in data) {
            ret += (data[i].name || '@') + '\t';
            if(data[i].ttl) ret += data[i].ttl + '\t';
            ret += 'IN\tA\t' + data[i].ip + '\n';
        }
        return template.replace('{a}', ret);
    };

    var processAAAA = function (data, template) {
        var ret = '';
        for (var i in data) {
            ret += (data[i].name || '@') + '\t';
            if(data[i].ttl) ret += data[i].ttl + '\t';
            ret += 'IN\tAAAA\t' + data[i].ip + '\n';
        }
        return template.replace('{aaaa}', ret);
    };

    var processCNAME = function (data, template) {
        var ret = '';
        for (var i in data) {
            ret += (data[i].name || '@') + '\t';
            if(data[i].ttl) ret += data[i].ttl + '\t';
            ret += 'IN\tCNAME\t' + data[i].alias + '\n';
        }
        return template.replace('{cname}', ret);
    };

    var processMX = function (data, template) {
        var ret = '';
        for (var i in data) {
            ret += (data[i].name || '@') + '\t';
            if(data[i].ttl) ret += data[i].ttl + '\t';
            ret += 'IN\tMX\t' + data[i].preference + '\t' + data[i].host + '\n';
        }
        return template.replace('{mx}', ret);
    };

    var processPTR = function (data, template) {
        var ret = '';
        for (var i in data) {
            ret += (data[i].name || '@') + '\t';
            if(data[i].ttl) ret += data[i].ttl + '\t';
            ret += 'IN\tPTR\t' + data[i].host + '\n';
        }
        return template.replace('{ptr}', ret);
    };

    var processTXT = function (data, template) {
        var ret = '';
        for (var i in data) {
            ret += (data[i].name || '@') + '\t';
            if(data[i].ttl) ret += data[i].ttl + '\t';
            ret += 'IN\tTXT\t"' + data[i].txt + '"\n';
        }
        return template.replace('{txt}', ret);
    };

    var processSRV = function (data, template) {
        var ret = '';
        for (var i in data) {
            ret += (data[i].name || '@') + '\t';
            if(data[i].ttl) ret += data[i].ttl + '\t';
            ret += 'IN\tSRV\t' + data[i].priority + '\t';
            ret += data[i].weight + '\t';
            ret += data[i].port + '\t';
            ret += data[i].target + '\n';
        }
        return template.replace('{srv}', ret);
    };

    var processValues = function (options, template) {
        template = template.replace('{zone}', options['$origin'] || options['soa']['name'] || '');
        template = template.replace('{datetime}', (new Date()).toISOString());
        return template.replace('{time}', Math.round(Date.now() / 1000));
    };

    //////////////////////////////////////////////////////////////////////////////

    var root_name = '@';

    var parse = function (text) {
        //text = removeComments(text);
        text = flatten(text);
        return parseRRs(text);
    };

    var removeComments = function (text) {
        return text.replace(/;[\s\S]*?$/gm, '');
    };

    var flatten = function (text) {
        var captured = [];
        var re = /\([\s\S]*?\)/gim;
        var match = re.exec(text);
        while (match !== null) {
            match.replacement = match[0].replace(/\s+/gm, ' ');
            captured.push(match);
            // captured Text, index, input
            match = re.exec(text);
        }
        var arrText = text.split('');
        for (var i in captured) {
            match = captured[i];
            arrText.splice(match.index, match[0].length, match.replacement);
        }
        return arrText.join('').replace(/\(|\)/gim, ' ');
    };

    var parseRRs = function (text) {
        var ret = {};
        var rrs = text.split('\n');
        for (var i in rrs) {
            var rr = rrs[i];
            if (!rr || !rr.trim()) {
                continue;
            }
            var uRR = rr.toUpperCase();
            if (uRR.indexOf('$ORIGIN') === 0) {
                ret.$origin = rr.split(/\s+/g)[1];
            } else if (uRR.indexOf('$TTL') === 0) {
                ret.$ttl = rr.split(/\s+/g)[1];
            } else if (/\s+SOA\s+/.test(uRR)) {
                ret.soa = parseSOA(rr);
            } else if (/\s+NS\s+/.test(uRR)) {
                ret.ns = ret.ns || [];
                ret.ns.push(parseNS(rr));
            } else if (/\s+A\s+/.test(uRR)) {
                ret.a = ret.a || [];
                ret.a.push(parseA(rr));
            } else if (/\s+AAAA\s+/.test(uRR)) {
                ret.aaaa = ret.aaaa || [];
                ret.aaaa.push(parseAAAA(rr));
            } else if (/\s+CNAME\s+/.test(uRR)) {
                ret.cname = ret.cname || [];
                ret.cname.push(parseCNAME(rr));
            } else if (/\s+TXT\s+/.test(uRR)) {
                ret.txt = ret.txt || [];
                ret.txt.push(parseTXT(rr));
            } else if (/\s+MX\s+/.test(uRR)) {
                ret.mx = ret.mx || [];
                ret.mx.push(parseMX(rr));
            } else if (/\s+PTR\s+/.test(uRR)) {
                ret.ptr = ret.ptr || [];
                ret.ptr.push(parsePTR(rr));
            } else if (/\s+SRV\s+/.test(uRR)) {
                ret.srv = ret.srv || [];
                ret.srv.push(parseSRV(rr));
            }
        }
        return ret;
    };

    var parseSOA = function (rr) {
        if (rr.indexOf('\t\t') === 0) rr = rr.replace('\t\t', root_name);
        var soa = {};
        var rrTokens = rr.trim().split(/\s+/g);
        if (rr.indexOf('\t\t') === -1) root_name = rrTokens[0];
        var l = rrTokens.length;
        soa.name = rrTokens[0];
        soa.minimum = parseInt(rrTokens[l - 1], 10);
        soa.expire = parseInt(rrTokens[l - 2], 10);
        soa.retry = parseInt(rrTokens[l - 3], 10);
        soa.refresh = parseInt(rrTokens[l - 4], 10);
        soa.serial = parseInt(rrTokens[l - 5], 10);
        soa.rname = rrTokens[l - 6];
        soa.mname = rrTokens[l - 7];
        if(!isNaN(rrTokens[1])) soa.ttl = parseInt(rrTokens[1], 10);
        return soa;
    };

    var parseNS = function (rr) {
        if (rr.indexOf('\t\t') === 0) rr = rr.replace('\t\t', root_name);
        var rrTokens = rr.trim().split(/\s+/g);
        if (rr.indexOf('\t\t') === -1) root_name = rrTokens[0];
        var l = rrTokens.length;
        var result = {
          name: rrTokens[0],
          host: rrTokens[l - 1]
        };

        if(!isNaN(rrTokens[1])) result.ttl = parseInt(rrTokens[1], 10);
        return result;
    };

    var parseA = function (rr) {
        if (rr.indexOf('\t\t') === 0) rr = rr.replace('\t\t', root_name);
        var rrTokens = rr.trim().split(/\s+/g);
        if (rr.indexOf('\t\t') === -1) root_name = rrTokens[0];
        var l = rrTokens.length;
        var result = {
          name: rrTokens[0],
          ip: rrTokens[l - 1]
        };

        if(!isNaN(rrTokens[1])) result.ttl = parseInt(rrTokens[1], 10);
        return result;
    };

    var parseAAAA = function (rr) {
        if (rr.indexOf('\t\t') === 0) rr = rr.replace('\t\t', root_name);
        var rrTokens = rr.trim().split(/\s+/g);
        if (rr.indexOf('\t\t') === -1) root_name = rrTokens[0];
        var l = rrTokens.length;
        var result = {
          name: rrTokens[0],
          ip: rrTokens[l - 1]
        };

        if(!isNaN(rrTokens[1])) result.ttl = parseInt(rrTokens[1], 10);
        return result;
    };

    var parseCNAME = function (rr) {
        if (rr.indexOf('\t\t') === 0) rr = rr.replace('\t\t', root_name);
        var rrTokens = rr.trim().split(/\s+/g);
        if (rr.indexOf('\t\t') === -1) root_name = rrTokens[0];
        var l = rrTokens.length;
        var result = {
          name: rrTokens[0],
          alias: rrTokens[l - 1]
        };

        if(!isNaN(rrTokens[1])) result.ttl = parseInt(rrTokens[1], 10);
        return result;
    };

    var parseMX = function (rr) {
        if (rr.indexOf('\t\t') === 0) rr = rr.replace('\t\t', root_name);
        var rrTokens = rr.trim().split(/\s+/g);
        if (rr.indexOf('\t\t') === -1) root_name = rrTokens[0];
        var l = rrTokens.length;
        var result = {
          name: rrTokens[0],
          preference: parseInt(rrTokens[l - 2], 10),
          host: rrTokens[l - 1]
        };

        if(!isNaN(rrTokens[1])) result.ttl = parseInt(rrTokens[1], 10);
        return result;
    };

    var parseTXT = function (rr) {
        if (rr.indexOf('\t\t') === 0) rr = rr.replace('\t\t', root_name);
        var rrTokens = rr.trim().match(/[^\s\"']+|\"[^\"]*\"|'[^']*'/g);
        if (rr.indexOf('\t\t') === -1) root_name = rrTokens[0];
        var l = rrTokens.length;
        var result = {
          name: rrTokens[0],
          txt: rrTokens[l - 1].split('\"')[1]
        };

        if(!isNaN(rrTokens[1])) result.ttl = parseInt(rrTokens[1], 10);
        return result;
    };

    var parsePTR = function (rr) {
        if (rr.indexOf('\t\t') === 0) rr = rr.replace('\t\t', root_name);
        var rrTokens = rr.trim().split(/\s+/g);
        if (rr.indexOf('\t\t') === -1) root_name = rrTokens[0];
        var l = rrTokens.length;
        var result = {
          name: rrTokens[0],
          host: rrTokens[l - 1]
        };

        if(!isNaN(rrTokens[1])) result.ttl = parseInt(rrTokens[1], 10);
        return result;
    };

    var parseSRV = function (rr) {
        if (rr.indexOf('\t\t') === 0) rr = rr.replace('\t\t', root_name);
        var rrTokens = rr.trim().split(/\s+/g);
        if (rr.indexOf('\t\t') === -1) root_name = rrTokens[0];
        var l = rrTokens.length;
        var result = {
          name: rrTokens[0],
          target: rrTokens[l - 1],
          priority: parseInt(rrTokens[l - 4], 10),
          weight: parseInt(rrTokens[l - 3], 10),
          port: parseInt(rrTokens[l - 2], 10)
        };

        if(!isNaN(rrTokens[1])) result.ttl = parseInt(rrTokens[1], 10);
        return result;
    };

    exports.generate = generate;
    exports.parse = parse;
})();
