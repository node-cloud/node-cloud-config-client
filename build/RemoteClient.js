'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _HttpClient = require('./HttpClient');

var httpClient = _interopRequireWildcard(_HttpClient);

var _ServerWatcher = require('./ServerWatcher');

var _ServerWatcher2 = _interopRequireDefault(_ServerWatcher);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

class RemoteConfig {
    constructor(options) {
        this.host = options.host;
        this.port = options.port;
        this.env = options.env;
        this.service = options.service;
        this.lastVersion = '';
        this.lastConfiguration = null;

        this.watcher = new _ServerWatcher2.default(this.host, this.port, this.service, this.env, options.interval);
        this.watcher.onUpdate((err, configuration) => {
            if (err) {
                this.errorCallback && this.errorCallback(err);
            }

            this.handleConfiguration(configuration);
        });

        this.refreshCallback = null;
        this.refreshAllCallback = null;
        this.errorCallback = null;
    }

    onRefresh(callback) {
        this.refreshCallback = callback;
    }

    onRefreshAll(callback) {
        this.refreshAllCallback = callback;
    }

    onError(callback) {
        this.errorCallback = callback;
    }

    end() {
        this.watcher.endWatch();
    }

    loadConfig() {
        var _this = this;

        return _asyncToGenerator(function* () {
            try {
                const configuration = yield httpClient.getRemoteConfig(_this.host, _this.port, _this.service, _this.env);
                _this.handleConfiguration(configuration);
                _this.watcher.startWatch();
            } catch (e) {
                _this.watcher.endWatch();
                throw e;
            }
        })();
    }

    getConfig(path, defaultValue) {
        var _this2 = this;

        return _asyncToGenerator(function* () {
            if (!_this2.lastConfiguration) {
                yield _this2.loadConfig();
            }

            const config = transformToObject(_this2.lastConfiguration || {});

            if (!path) {
                return config;
            }

            return _lodash2.default.get(config, path, defaultValue);
        })();
    }

    handleConfiguration(configuration) {
        if (this.lastVersion !== configuration.version) {
            this.lastVersion = configuration.version;
            const finalConfiguration = this.getFinalConfigurationSource(configuration);
            this.compareAndSet(finalConfiguration);
        }
    }

    /**
     *
     * @param configuration
     * @param configuration.propertySources
     * @param configuration.finalSource
     * @return {*}
     */
    getFinalConfigurationSource(configuration) {
        const sources = configuration.propertySources;
        if (sources.length > 0 && !this.lastConfiguration) {
            this.lastConfiguration = {};
        }

        let globalSource = null,
            envSource = null,
            source = null;
        const finalSource = {};

        sources.forEach(item => {
            if (item.name && ~item.name.indexOf("application.yml")) {
                globalSource = item.source;
            } else if (item.name && ~item.name.indexOf(this.service + '-' + this.env + '.yml')) {
                envSource = item.source;
            } else if (item.name && ~item.name.indexOf(this.service + '.yml')) {
                source = item.source;
            }
        });

        [globalSource, source, envSource].filter(source => source).forEach(source => Object.assign(finalSource, source));
        configuration.finalSource = finalSource;

        return configuration;
    }

    compareAndSet(configuration) {
        if (!configuration.finalSource) {
            return;
        }

        for (const key in configuration.finalSource) {
            if (!configuration.finalSource.hasOwnProperty(key)) {
                continue;
            }

            if (this.lastConfiguration[key] !== configuration.finalSource[key]) {
                this.lastConfiguration[key] = configuration.finalSource[key];

                this.refreshCallback && this.refreshCallback(key, this.lastConfiguration[key]);
            }
        }

        if (this.lastConfiguration) {
            this.refreshAllCallback && this.refreshAllCallback(this.lastConfiguration);
        }
    }
}

exports.default = RemoteConfig;
function transformToObject(configuration) {
    const config = {};
    for (const key in configuration) {
        if (!configuration.hasOwnProperty(key)) {
            continue;
        }

        _lodash2.default.set(config, key, configuration[key]);
    }

    return config;
}