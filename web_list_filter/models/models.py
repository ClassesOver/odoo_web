# -*- coding: utf-8 -*-

from odoo import models, fields, api, tools


class Base(models.AbstractModel):
    _inherit = 'base'

    @api.model
    def filter_values_get(self, column):
        groups = self.read_group(fields=[column], groupby=column, domain=[])
        field = getattr(type(self), column)
        l = []
        for g in groups:
            if not g['%s_count' % column]:
                continue
            if field.type == 'many2one':
                v = (False, '') if g[column] is False else g[column]
                l.append(v)
            else:
                l.append((g[column], g[column]))
        return l


