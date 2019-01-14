# Copyright 2013-2017 Ent. Services Development Corporation LP
#
# Redistribution and use of this software in source and binary forms,
# with or without modification, are permitted provided that the following
# conditions are met:
#
# Redistributions of source code must retain the above copyright notice,
# this list of conditions and the following disclaimer.
#
# Redistributions in binary form must reproduce the above copyright
# notice, this list of conditions and the following disclaimer in the
# documentation and/or other materials provided with the distribution.
#
# THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
# "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
# LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
# A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
# OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
# SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
# LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
# DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
# THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
# (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
# OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

import logging
import string

from random import choice

from pyramid.settings import asbool
from pyramid.httpexceptions import HTTPSeeOther

from beaker.exceptions import BeakerException


def setup_tweens(config, settings):
    """Since tweens order is important this function will
    take care of proper ordering"""

    config.add_tween('eucaconsole.tweens.https_tween_factory')
    config.add_tween('eucaconsole.tweens.request_id_tween_factory')
    config.add_tween('eucaconsole.tweens.invalidate_session_cookie_tween_factory')
    config.add_tween('eucaconsole.tweens.CTHeadersTweenFactory')
    if asbool(settings.get('log.useractions', 'false')):
        config.add_tween('eucaconsole.tweens.usage_log_tween_factory')


def https_tween_factory(handler, registry):
    def tween(request):
        response = handler(request)
        if request.environ.get('HTTP_X_FORWARDED_PROTO') == 'https':
            request.scheme = 'https'
        return response
    return tween


def request_id_tween_factory(handler, registry):
    def tween(request):
        chars = string.letters + string.digits
        request.id = ''.join(choice(chars) for i in range(16))
        response = handler(request)
        return response
    return tween


def usage_log_tween_factory(handler, registry):
    def tween(request):
        method = request.environ['REQUEST_METHOD']
        path = request.environ['PATH_INFO']
        remote_addr = request.environ.get('HTTP_X_FORWARDED_FOR', request.environ['REMOTE_ADDR'])
        content_type = request.environ.get('CONTENT_TYPE', '')
        if method == 'GET' and path.find('static') == -1:
            if 'HTTP_X_REQUESTED_WITH' not in request.environ:
                # assume this is a page root
                logging.info('user-nav: {0} {1}'.format(remote_addr, path))
        if method in ['POST', 'PUT', 'DELETE'] \
                and (path.find('json') == -1 or content_type == 'application/x-www-form-urlencoded'):
            logging.info('user-action: {0} {1}'.format(remote_addr, path))
        response = handler(request)
        return response
    return tween


def invalidate_session_cookie_tween_factory(handler, registry):
    def tween(request):
        try:
            response = handler(request)
            return response
        except BeakerException as bex:
            if bex.message == 'Invalid signature':
                session_cookie = registry.settings.get('session.key', 'eucaconsole_session')
                if session_cookie in request.cookies and \
                        'invalidate-session' not in request.params:
                    response = HTTPSeeOther(request.route_url("login",
                                                              _query={'invalidate-session': '1'}))
                    response.delete_cookie(session_cookie)
                    logging.info('Invalid cookie (session key changed?), redirecting to login')
                    return response
            raise
    return tween


class CTHeadersTweenFactory(object):
    """Tween factory for ensuring certain response headers are set iff content type is mapped."""

    header_map = {
        'application/json': {
            'Cache-Control': 'NO-CACHE',
            'Pragma': 'NO-CACHE',
        },
        'text/html': {
            'X-Frame-Options': 'SAMEORIGIN',
            'Cache-Control': 'NO-CACHE',
            'Pragma': 'NO-CACHE',
            'Content-Security-Policy': "script-src 'self'; form-action 'self';",
            'X-Content-Security-Policy': "script-src 'self'; form-action 'self';",
        },
    }

    def __init__(self, handler, registry):
        self.handler = handler
        self.registry = registry

    def __call__(self, request):
        response = self.handler(request)
        ct = response.content_type or ''
        ct_key = ct.strip().lower()
        ct_header_map = self.header_map.get(ct_key, None)
        if ct_header_map:
            for name, value in ct_header_map.items():
                response.headers[name] = value
        return response
