// Load modules

var Http = require('http');
var Hoek = require('hoek');


// Declare internals

var internals = {};

exports.wrap = function (error, statusCode, message) {

    Hoek.assert(error instanceof Error, 'Cannot wrap non-Error object');
    return (error.isBoom ? error : internals.initialize(error, statusCode || 500, message));
};


exports.create = function (statusCode, message, data) {
    return internals.create(statusCode, message, data, exports.create);
};


internals.create = function (statusCode, message, data, fn) {
    var ctor;
    if (!exports.errorTypes[fn.name]) {
      ctor = Error;
    } else {
      ctor = exports.errorTypes[fn.name]
    }

    var error =  new ctor(message ? message : undefined);       // Avoids settings null message
    Error.captureStackTrace(error, fn);                       // Filter the stack to our external API
    error.data = data || null;
    internals.initialize(error, statusCode);
    return error;
};

internals.initialize = function (error, statusCode, message) {

    var numberCode = parseInt(statusCode, 10);
    Hoek.assert(!isNaN(numberCode) && numberCode >= 400, 'First argument must be a number (400+):', statusCode);

    error.isBoom = true;
    error.isServer = numberCode >= 500;

    if (!error.hasOwnProperty('data')) {
        error.data = null;
    }

    error.output = {
        statusCode: numberCode,
        payload: {},
        headers: {}
    };

    error.reformat = internals.reformat;
    error.reformat();

    if (!message &&
        !error.message) {

        message = error.output.payload.error;
    }

    if (message) {
        error.message = (message + (error.message ? ': ' + error.message : ''));
    }

    return error;
};


internals.reformat = function () {

    this.output.payload.statusCode = this.output.statusCode;
    this.output.payload.error = Http.STATUS_CODES[this.output.statusCode] || 'Unknown';

    if (this.output.statusCode === 500) {
        this.output.payload.message = 'An internal server error occurred';              // Hide actual error from user
    }
    else if (this.message) {
        this.output.payload.message = this.message;
    }
};


// 4xx Client Errors
exports.badRequest = function badRequest (message, data) {

    return internals.create(400, message, data, exports.badRequest);
};


exports.unauthorized = function unauthorized (message, scheme, attributes) {          // Or function (message, wwwAuthenticate[])

    var err = internals.create(401, message, undefined, exports.unauthorized);

    if (!scheme) {
        return err;
    }

    var wwwAuthenticate = '';
    var i = 0;
    var il = 0;

    if (typeof scheme === 'string') {

        // function (message, scheme, attributes)

        wwwAuthenticate = scheme;

        if (attributes || message) {
            err.output.payload.attributes = {};
        }

        if (attributes) {
            var names = Object.keys(attributes);
            for (i = 0, il = names.length; i < il; ++i) {
                var name = names[i];
                if (i) {
                    wwwAuthenticate += ',';
                }

                var value = attributes[name];
                if (value === null ||
                    value === undefined) {              // Value can be zero

                    value = '';
                }
                wwwAuthenticate += ' ' + name + '="' + Hoek.escapeHeaderAttribute(value.toString()) + '"';
                err.output.payload.attributes[name] = value;
            }
        }

        if (message) {
            if (attributes) {
                wwwAuthenticate += ',';
            }
            wwwAuthenticate += ' error="' + Hoek.escapeHeaderAttribute(message) + '"';
            err.output.payload.attributes.error = message;
        }
        else {
            err.isMissing = true;
        }
    }
    else {

        // function (message, wwwAuthenticate[])

        var wwwArray = scheme;
        for (i = 0, il = wwwArray.length; i < il; ++i) {
            if (i) {
                wwwAuthenticate += ', ';
            }

            wwwAuthenticate += wwwArray[i];
        }
    }

    err.output.headers['WWW-Authenticate'] = wwwAuthenticate;

    return err;
};


exports.forbidden = function forbidden (message, data) {

    return internals.create(403, message, data, exports.forbidden);
};


exports.notFound = function notFound (message, data) {

    return internals.create(404, message, data, exports.notFound);
};


exports.methodNotAllowed = function methodNotAllowed (message, data) {

    return internals.create(405, message, data, exports.methodNotAllowed);
};


exports.notAcceptable = function notAcceptable (message, data) {

    return internals.create(406, message, data, exports.notAcceptable);
};


exports.proxyAuthRequired = function proxyAuthRequired (message, data) {

    return internals.create(407, message, data, exports.proxyAuthRequired);
};


exports.clientTimeout = function clientTimeout (message, data) {

    return internals.create(408, message, data, exports.clientTimeout);
};


exports.conflict = function conflict (message, data) {

    return internals.create(409, message, data, exports.conflict);
};


exports.resourceGone = function resourceGone (message, data) {

    return internals.create(410, message, data, exports.resourceGone);
};


exports.lengthRequired = function lengthRequired (message, data) {

    return internals.create(411, message, data, exports.lengthRequired);
};


exports.preconditionFailed = function preconditionFailed (message, data) {

    return internals.create(412, message, data, exports.preconditionFailed);
};


exports.entityTooLarge = function entityTooLarge (message, data) {

    return internals.create(413, message, data, exports.entityTooLarge);
};


exports.uriTooLong = function uriTooLong (message, data) {

    return internals.create(414, message, data, exports.uriTooLong);
};


exports.unsupportedMediaType = function unsupportedMediaType (message, data) {

    return internals.create(415, message, data, exports.unsupportedMediaType);
};


exports.rangeNotSatisfiable = function rangeNotSatisfiable (message, data) {

    return internals.create(416, message, data, exports.rangeNotSatisfiable);
};


exports.expectationFailed = function expectationFailed (message, data) {

    return internals.create(417, message, data, exports.expectationFailed);
};

exports.badData = function badData (message, data) {

    return internals.create(422, message, data, exports.badData);
};


exports.tooManyRequests = function tooManyRequests (message, data) {

    return internals.create(429, message, data, exports.tooManyRequests);
};


// 5xx Server Errors

exports.internal = function internal (message, data, statusCode) {

    return internals.serverError(message, data, statusCode, exports.internal);
};

internals.serverError = function (message, data, statusCode, ctor) {

    var error;
    if (data instanceof Error) {
        error = exports.wrap(data, statusCode, message);
    } else {
        error = internals.create(statusCode || 500, message, ctor);
        error.data = data;
    }

    return error;
};


exports.notImplemented = function notImplemented (message, data) {

    return internals.serverError(message, data, 501, exports.notImplemented);
};


exports.badGateway = function badGateway (message, data) {

    return internals.serverError(message, data, 502, exports.badGateway);
};


exports.serverTimeout = function serverTimeout (message, data) {

    return internals.serverError(message, data, 503, exports.serverTimeout);
};


exports.gatewayTimeout = function gatewayTimeout (message, data) {

    return internals.serverError(message, data, 504, exports.gatewayTimeout);
};


exports.badImplementation = function badImplementation (message, data) {

    var err = internals.serverError(message, data, 500, exports.badImplementation);
    err.isDeveloperError = true;
    return err;
};


// Populate export error types (all exported functions excluding 'create' and 'wrap')
exports.errorTypes = {};
Object.keys(exports).forEach(function (method) {
    if (method === 'create' || method === 'wrap' || method === 'errorTypes') {
        return
    }

    exports.errorTypes[method] = function () {};
    exports.errorTypes[method].prototype = Object.create(Error.prototype);
    exports.errorTypes[method].prototype.constructor = exports.errorTypes[method];
})
