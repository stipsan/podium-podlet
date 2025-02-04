'use strict';

/* eslint-disable no-underscore-dangle */
/* eslint-disable prefer-destructuring */
/* eslint-disable import/no-extraneous-dependencies */

const originalUrl = require('original-url');
const Metrics = require('@metrics/client');
const schemas = require('@podium/schemas');
const abslog = require('abslog');
const utils = require('@podium/utils');
const Proxy = require('@podium/proxy');
const merge = require('lodash.merge');
const URL = require('url').URL;
const joi = require('joi');
const template = require('./template');

const _sanitize = Symbol('_sanitize');
const _template = Symbol('_template');
const _version = Symbol('_version');
const _context = Symbol('_context');
const _default = Symbol('_default');

const PodiumPodlet = class PodiumPodlet {
    constructor({
        name = '',
        version = '',
        pathname = '',
        manifest = '/manifest.json',
        fallback = '',
        content = '/',
        logger = undefined,
        development = false,
    } = {}) {
        joi.attempt(
            name,
            schemas.manifest.name,
            new Error(
                `The value, "${name}", for the required argument "name" on the Podlet constructor is not defined or not valid.`,
            ),
        );

        joi.attempt(
            version,
            schemas.manifest.version,
            new Error(
                `The value, "${version}", for the required argument "version" on the Podlet constructor is not defined or not valid.`,
            ),
        );

        joi.attempt(
            pathname,
            schemas.manifest.uri,
            new Error(
                `The value, "${pathname}", for the required argument "pathname" on the Podlet constructor is not defined or not valid.`,
            ),
        );

        joi.attempt(
            manifest,
            schemas.manifest.uri,
            new Error(
                `The value, "${manifest}", for the optional argument "manifest" on the Podlet constructor is not valid.`,
            ),
        );

        joi.attempt(
            content,
            schemas.manifest.content,
            new Error(
                `The value, "${content}", for the optional argument "content" on the Podlet constructor is not valid.`,
            ),
        );

        joi.attempt(
            fallback,
            schemas.manifest.fallback,
            new Error(
                `The value, "${fallback}", for the optional argument "fallback" on the Podlet constructor is not valid.`,
            ),
        );

        Object.defineProperty(this, 'name', {
            value: name,
        });

        Object.defineProperty(this, 'version', {
            value: version,
        });

        Object.defineProperty(this, '_pathname', {
            value: this[_sanitize](pathname),
        });

        Object.defineProperty(this, 'manifestRoute', {
            value: this[_sanitize](manifest),
        });

        Object.defineProperty(this, 'contentRoute', {
            value: this[_sanitize](content),
        });

        Object.defineProperty(this, 'fallbackRoute', {
            value: this[_sanitize](fallback),
        });

        Object.defineProperty(this, 'cssRoute', {
            value: '',
            writable: true,
        });

        Object.defineProperty(this, 'jsRoute', {
            value: '',
            writable: true,
        });

        Object.defineProperty(this, 'proxyRoutes', {
            value: {},
        });

        Object.defineProperty(this, 'log', {
            value: abslog(logger),
        });

        Object.defineProperty(this, 'development', {
            value: development,
        });

        Object.defineProperty(this, '_proxy', {
            value: new Proxy(
                merge(
                    {
                        pathname: this._pathname,
                        logger: this.log,
                    },
                    {},
                ),
            ),
        });

        Object.defineProperty(this, 'baseContext', {
            value: {
                debug: 'false',
                locale: 'en-US',
                deviceType: 'desktop',
                requestedBy: this.name,
                mountOrigin: '',
                mountPathname: this._pathname,
                publicPathname: this._pathname,
            },
            writable: false,
        });

        Object.defineProperty(this, 'defaultContext', {
            value: {},
            writable: true,
        });

        Object.defineProperty(this, 'metrics', {
            enumerable: true,
            value: new Metrics(),
        });

        Object.defineProperty(this, '_view', {
            value: template,
            writable: true,
        });

        Object.defineProperty(this, 'chain', {
            value: [],
        });

        this.chain.push(this[_default]());
        this.chain.push(this[_context]());
        this.chain.push(this[_version]());
        this.chain.push(this[_template]());
        if (this.development) {
            this.chain.push(this._proxy.middleware());
        }
    }

    get [Symbol.toStringTag]() {
        return 'PodiumPodlet';
    }

    middleware() {
        return this.chain;
    }

    render(fragment, res) {
        if (utils.getFromLocalsPodium(res, 'decorate')) {
            return this._view(fragment, res);
        }
        return fragment;
    }

    pathname() {
        return this._pathname;
    }

    manifest({ prefix = false } = {}) {
        return this[_sanitize](this.manifestRoute, prefix);
    }

    content({ prefix = false } = {}) {
        return this[_sanitize](this.contentRoute, prefix);
    }

    fallback({ prefix = false } = {}) {
        return this[_sanitize](this.fallbackRoute, prefix);
    }

    css({ value = null, prefix = false } = {}) {
        if (!value) {
            return this[_sanitize](this.cssRoute, prefix);
        }

        if (this.cssRoute) {
            throw new Error('Value for "css" has already been set');
        }

        joi.attempt(
            value,
            schemas.manifest.css,
            new Error(
                `Value on argument variable "value", "${value}", is not valid`,
            ),
        );

        this.cssRoute = this[_sanitize](value);

        return this[_sanitize](this.cssRoute, prefix);
    }

    js({ value = null, prefix = false } = {}) {
        if (!value) {
            return this[_sanitize](this.jsRoute, prefix);
        }

        if (this.jsRoute) {
            throw new Error('Value for "js" has already been set');
        }

        joi.attempt(
            value,
            schemas.manifest.js,
            new Error(
                `Value on argument variable "value", "${value}", is not valid`,
            ),
        );

        this.jsRoute = this[_sanitize](value);

        return this[_sanitize](this.jsRoute, prefix);
    }

    proxy({ target = null, name = null } = {}) {
        joi.attempt(
            target,
            schemas.manifest.uri,
            new Error(
                `Value on argument variable "target", "${target}", is not valid`,
            ),
        );

        joi.attempt(
            name,
            schemas.manifest.name,
            new Error(
                `Value on argument variable "name", "${name}", is not valid`,
            ),
        );

        if (Object.keys(this.proxyRoutes).length >= 4) {
            throw new Error(
                `One can not define more than 4 proxy targets for each podlet`,
            );
        }

        this.proxyRoutes[name] = target;

        if (this.development) {
            this._proxy.register(this);
        }

        return target;
    }

    defaults(context = null) {
        if (context) {
            this.defaultContext = context;
        }
        return Object.assign({}, this.baseContext, this.defaultContext);
    }

    view(fn = null) {
        if (!utils.isFunction(fn)) {
            throw new Error(
                `Value on argument variable "template" must be a function`,
            );
        }
        this._view = fn;
    }

    toJSON() {
        return {
            name: this.name,
            version: this.version,
            content: this.contentRoute,
            fallback: this.fallbackRoute,
            assets: {
                js: this.jsRoute,
                css: this.cssRoute,
            },
            proxy: this.proxyRoutes,
        };
    }

    [_sanitize](uri, prefix = false) {
        const pathname = prefix ? this._pathname : '';
        if (uri) {
            return utils.uriIsRelative(uri)
                ? utils.pathnameBuilder(pathname, uri)
                : uri;
        }
        return uri;
    }

    [_default]() {
        return (req, res, next) => {
            if (this.development) {
                const url = originalUrl(req);
                const parsed = new URL(url.full);

                const context = Object.assign(
                    this.baseContext,
                    { mountOrigin: parsed.origin },
                    this.defaultContext,
                );

                utils.setAtLocalsPodium(res, 'context', context);

                this.log.debug(
                    `Appending a default context to inbound request "${JSON.stringify(
                        context,
                    )}"`,
                );
            }

            next();
        };
    }

    [_context]() {
        return (req, res, next) => {
            let context = utils.deserializeContext(req.headers);

            this.log.debug(
                `Inbound request contains a context "${JSON.stringify(
                    context,
                )}"`,
            );

            if (this.development) {
                const defaults = utils.getFromLocalsPodium(res, 'context');
                context = Object.assign(defaults, context);

                this.log.debug(
                    `Merged default context with context on inbound request "${JSON.stringify(
                        context,
                    )}"`,
                );
            }

            utils.setAtLocalsPodium(res, 'context', context);
            next();
        };
    }

    [_version]() {
        return (req, res, next) => {
            this.log.debug(`Header "podlet-version" set to "${this.version}"`);
            res.setHeader('podlet-version', this.version);
            next();
        };
    }

    [_template]() {
        return (req, res, next) => {
            utils.setAtLocalsPodium(res, 'decorate', this.development);
            utils.setAtLocalsPodium(res, 'name', this.name);
            utils.setAtLocalsPodium(res, 'css', this.cssRoute);
            utils.setAtLocalsPodium(res, 'js', this.jsRoute);

            if (
                req.headers['user-agent'] &&
                req.headers['user-agent'].startsWith('@podium/client')
            ) {
                utils.setAtLocalsPodium(res, 'decorate', false);
            }

            res.podiumSend = content => {
                res.send(this.render(content, res));
            };

            next();
        };
    }
};

module.exports = PodiumPodlet;
