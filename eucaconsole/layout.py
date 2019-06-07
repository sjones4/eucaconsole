# -*- coding: utf-8 -*-
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

"""
Layout configuration via pyramid_layout
See http://docs.pylonsproject.org/projects/pyramid_layout/en/latest/layouts.html

"""
import socket

from collections import namedtuple
from urllib import urlencode
from boto.exception import BotoServerError

from pyramid.decorator import reify
from pyramid.renderers import get_renderer
from pyramid.settings import asbool

from .constants import AWS_REGIONS
from .forms.login import EucaLogoutForm
from .i18n import _
from .models import Notification
from .models.auth import ConnectionManager, RegionCache
from .views import BaseView

try:
    from version import __version__
except ImportError:
    __version__ = 'DEVELOPMENT'


class MasterLayout(object):
    ATS = "Eucalyptus Management Console"

    def __init__(self, context, request):
        self.context = context
        self.request = request
        self.version = __version__
        self.help_url = request.registry.settings.get('help.url')
        self.support_url = request.registry.settings.get('support.url') or "http://support.eucalyptus.com"
        self.aws_enabled = asbool(request.registry.settings.get('aws.enabled'))
        self.browser_password_save = 'true' if asbool(
            request.registry.settings.get('browser.password.save')) else 'false'
        self.cloud_type = request.session.get('cloud_type')
        self.auth_type = request.session.get('auth_type')
        self.username = self.request.session.get('username')
        self.account = self.request.session.get('account')
        self.access_id = self.request.session.get('access_id')
        self.has_regions = True
        self.default_region = ''
        if self.cloud_type == 'aws':
            self.default_region = request.registry.settings.get('aws.default.region', 'us-east-1')
            self.regions = list(AWS_REGIONS)
            if asbool(request.registry.settings.get('aws.govcloud.enabled', 'false')):
                self.regions.append(dict(name='us-gov-west-1', label='US GovCloud'))
        else:
            if self.access_id:
                host = self.request.registry.settings.get('ufshost')
                port = self.request.registry.settings.get('ufsport')
                secret_key = self.request.session.get('secret_key')
                session_token = self.request.session.get('session_token')
                dns_enabled = self.request.session.get('dns_enabled')
                conn = ConnectionManager.euca_connection(
                    host, port, 'euca', self.access_id, secret_key, session_token, 'ec2', dns_enabled
                )
                try:
                    self.regions = RegionCache(conn).regions()
                    if len(self.regions) == 1:
                        self.has_regions = False
                    self.default_region = request.registry.settings.get('default.region', None)
                    if self.default_region is None:
                        for region in self.regions:
                            if region['endpoints']['ec2'].find(host) > -1:
                                self.default_region = region['name']
                except BotoServerError:
                    self.has_regions = False
                except socket.error:
                    self.has_regions = False
        if hasattr(self, 'regions'):
            self.selected_region = self.request.session.get('region', self.default_region)
            if (self.selected_region == '' or
                self.selected_region == 'undefined' or
                self.selected_region == 'euca'):
                self.selected_region = self.default_region
            self.selected_region_label = self.get_selected_region_label(self.selected_region, self.regions)
        self.username_label = self.request.session.get('username_label')
        self.account_access = request.session.get('account_access') if self.cloud_type == 'euca' else False
        self.user_access = request.session.get('user_access') if self.cloud_type == 'euca' else False
        self.group_access = request.session.get('group_access') if self.cloud_type == 'euca' else False
        self.role_access = request.session.get('role_access') if self.cloud_type == 'euca' else False
        self.euca_logout_form = EucaLogoutForm(request=self.request)
        self.date_format = _(u'%I:%M:%S %p %b %d %Y')
        self.angular_date_format = _(u'hh:mm:ss a MMM d yyyy')
        self.tag_pattern_key = '^(?!aws:)(?!euca:).{0,128}$'
        self.tag_pattern_value = '^(?!aws:).{0,256}$'
        self.integer_gt_zero_pattern = '^[1-9]\d*$'
        self.non_negative_pattern = '^[0-9]\d*$'
        self.cidr_pattern = u'{0}{1}'.format(
            '^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}',
            '(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])(\/\d+)$'
        )
        self.ascii_without_slashes_pattern = r'^((?![\x2F\x5c])[\x20-\x7F]){1,255}$'
        self.name_without_spaces_pattern = r'^[a-zA-Z0-9\-]{1,255}$'
        self.port_range_pattern = u'{0}'.format(
            '^([1-9][0-9]{0,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])$')
        self.querystring = self.get_query_string()
        self.help_html_dir = 'eucaconsole:static/html/help/'
        self.escape_braces = BaseView.escape_braces
        self.file_uploads_enabled = asbool(self.request.registry.settings.get('file.uploads.enabled', True))
        self.searchtext_remove = _(u'Remove facet')
        self.searchtext_cancel = _(u'Clear search')
        self.searchtext_prompt = _(u'Select facets for filter, or enter text to search')
        self.searchtext_prompt2 = _(u'Enter text to search')
        self.searchtext_text_facet = _(u'Text')
        self.standard_table_repeat = 'item in items | orderBy: sortBy | limitTo:displayCount'
        self.smart_table_repeat = 'item in displayedCollection | limitTo:displayCount'

    def get_notifications(self):
        """Get notifications, categorized by message type ('info', 'success', 'warning', or 'error')
        To add a success notification, use self.request.session.flash(msg, 'success')
        See http://docs.pylonsproject.org/projects/pyramid/en/latest/narr/sessions.html#using-the-session-flash-method
        """
        notifications = []
        notification = namedtuple('Notification', ['message', 'type', 'style'])
        for queue in Notification.TYPES:
            for notice in self.request.session.pop_flash(queue=queue):
                notifications.append(
                    notification(message=notice, type=queue, style=Notification.FOUNDATION_STYLES.get(queue)))
        # Add custom error messages via self.request.error_messages = [message_1, message_2, ...] in the view
        error_messages = getattr(self.request, 'error_messages', [])
        for error in error_messages:
            queue = Notification.ERROR
            notifications.append(
                notification(message=error, type=queue, style=Notification.FOUNDATION_STYLES.get(queue))
            )
        return notifications

    def get_query_string(self):
        if self.request.GET:
            return u'?{0}'.format(urlencode(BaseView.encode_unicode_dict(self.request.GET)))
        return ''

    def help_path(self, help_html):
        path = self.help_html_dir + help_html
        return self.request.static_path(path)

    @staticmethod
    def get_selected_region_label(region_name, regions):
        """Get the label from the selected region"""
        regions = [reg for reg in regions if reg.get('name') == region_name]
        if regions:
            return regions[0].get('label')
        return ''

    @reify
    def global_macros(self):
        renderer = get_renderer("templates/macros.pt")
        return renderer.implementation().macros
