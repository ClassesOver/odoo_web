odoo.define('web.widgets', function (require) {

	var ListController = require('web.ListController')
	var ListRenderer = require('web.ListRenderer')
	var Widget = require('web.Widget')
	var core = require('web.core')

	function coJsId (ref, value) {
		this._refValue = value
		this._ref = ref
		this._id = _.uniqueId('co_')
	}

	coJsId.prototype.toString = function () {
		return this._id
	}

	function lfJsId (ref, value) {
		this._refValue = value
		this._ref = ref
		this._id = _.uniqueId('lf_')
	}

	lfJsId.prototype.toString = function () {
		return this._id
	}

	var CheckOption = Widget.extend({
		template: 'web.ListFilterCheck',
		events: {
			'click': '_onClick'
		},
		init: function (parent, value, checked) {
			this._super(parent)
			this.jsId = new coJsId(this, value)
			this.value = value
			this.checked = checked
			this.manager = parent
			this.manager.on('input', this, this.proxy('show'))
		},
		start: function () {
			this.$('input').prop('checked', this.checked)
			console.debug(`CheckOption-${this.jsId} is started.`)
		},
		show: function (v) {
			var reg = new RegExp(v, 'i')
			if (`${this.value}`.search(reg) !== -1) {
				this.$el.show()
			} else {
				if (!this.checked) {
					this.$el.hide()
				}
			}
		},
		check: function (v) {
			this.checked = v
			this.$('input').prop('checked', this.checked)
			this.trigger_up('checked', {checked: this.checked})
		},
		_onClick: function (ev) {
			ev.stopPropagation()
			ev.preventDefault()
			var checked = !this.checked
			this.$('input').prop('checked', checked)
			this.trigger_up('checked', {checked: checked})
			this.checked = checked
		}
	})

	var ListFilter = Widget.extend({
		template: 'web.ListFilter',
		events: {
			'click': function (ev) {
				ev.stopPropagation()
			},
			'input input.form__field': '_onInput'
		},
		custom_events: {
			'checked': '_onChecked',
		},
		_onInput: function (ev) {
			var $input = $(ev.currentTarget)
			var s = $input.val()
			this.trigger('input', s)
		},
		_onChecked: function (ev) {
			var w = ev.target
			if (w instanceof Widget) {
				if (ev.data.checked) {
					w.$el.appendTo(this.$('ul.checked'))
					this.checkedOptionJsIds.push(w.jsId)
				} else {
					this.checkedOptionJsIds = _.without(this.checkedOptionJsIds, w.jsId)
					var idx = _.findIndex(this.optionJsIds, v => v === w.jsId)
					var ids = this.optionJsIds.slice(0, idx)
					ids.reverse()
					var insertAfter = false
					for (const it of ids) {
						var $el = this.$(`ul.options > li[data-id=${it}]`)
						if ($el.length > 0) {
							w.$el.insertAfter($($el[0]))
							insertAfter = true
							break
						}
					}
					if (!insertAfter) {
						w.$el.prependTo(this.$('ul.options'))
					}

				}

			}
			this.toggleTouch();
			var values = this.checkedOptionJsIds.map(jsId => {return jsId._refValue[0]});
			this.trigger_up('update_domain', {name: this.name, values: values});

		},
		toggleTouch: function () {
			if (this.checkedOptionJsIds.length > 0) {
				this.$ref.find('.o_filter').addClass('touch')
			} else {
				this.$ref.find('.o_filter').removeClass('touch')
			}
		},
		setRef: function ($node) {
			this.$ref = $node;
			this.toggleTouch();
		},
		updatePosition: function () {
			var el = this.$ref[0]
			var rect = this.$ref[0].getBoundingClientRect()
			var h = rect.height
			var w = rect.width;
			var ow = document.querySelector('body').offsetWidth
			if ((rect.x + this.$el[0].offsetWidth) > ow) {
				this.offset = {top: rect.y + h + 1, right: 1}
			} else {
				this.offset = {top: rect.y + h + 1, left: rect.x}
			}
			this.$el.css(this.offset)
		},
		init: function (parent, state, params) {
			this._super(parent)
			this.jsId = params.jsId
			this.name = params.name
			this.$ref = params.$ref
			this.state = state
			this.string = this.state.fields[this.name].string
			this.optionJsIds = []
			this.isInDOM = false
			this.checkedOptionJsIds = []
			core.bus.on('click', this, this.proxy('detach'))
			this._starts = 0
			this._stores = []
			this._store = {checkedOptionJsIds: []}
			this.manager = parent;
			this.manager.on('resize', this, this._onResize)
		},
		_onResize: function () {
			if (this.isInDOM) {
				this.updatePosition()
			}
		},
		detach: function () {
			if (this.$el) {
				this.$el.detach()
				this.isInDOM = false
			}
			this._store.checkedOptionJsIds = [...this.checkedOptionJsIds]
		},
		start: function () {
			this._starts++
			this.checkedOptionJsIds = []
			this._store = {checkedOptionJsIds: []}
			this._stores.push(this._store)
			this.isInDOM = true
			this.updatePosition()
			this.fetch().then(() => {
				for (var ck of this.toChecked.toCheckedValues) {
					for (var w of this.toChecked.widgets.filter(w => { return _.isEqual(w.value, ck)})) {
						w.check(true)
					}
				}
			})

		},
		doPushOptionWidget: function (r, toChecked) {
			var w = new CheckOption(this, r, false)
			var idx = _.findIndex(toChecked, function (v) {
				return _.isEqual(v, r)
			})
			if (idx !== -1) {
				this.toChecked.widgets.push(w)
			}
			var promise = w.appendTo(this.$('ul.options'))
			this.optionJsIds.push(w.jsId)
			return promise
		},
		fetch: function () {
			this.optionJsIds = []
			return this._rpc({
				model: this.state.model,
				method: 'filter_values_get',
				args: [this.name],
				kwargs: {
					context: this.state.context,
				}
			}).then(resp => {
				if (resp instanceof Array) {
					var promises = []
					var prevStore = this._stores.slice(-2)[0] || {checkedOptionJsIds: []}
					var toCheckedValues = prevStore.checkedOptionJsIds.map(jsId => jsId._refValue)
					this.toChecked = {widgets: [], toCheckedValues: toCheckedValues}
					for (var r of resp) {
						var promise = this.doPushOptionWidget(r, toCheckedValues)
						promises.push(promise)
					}
					return $.when.apply($, promises)

				}
			})
		},
	})
	ListController.include({
		custom_events: _.extend({}, ListController.prototype.custom_events, {
			'search_filter_domain_updated': '_onUpdateSearchFilterDomain',
		}),
		_onUpdateSearchFilterDomain: function (ev) {
			this.reload({offset: 0, domain: ev.data.domain});
		},
	})
	ListRenderer.include({
		custom_events: _.extend({}, ListRenderer.prototype.custom_events, {
			'update_domain': '_onUpdateDomain',
		}),
		init: function () {
			this._super.apply(this, arguments)
			this.initFilters()
			this.observer = new ResizeObserver(es => {
				for (var e of es) {
					this.trigger('resize', {contentRect: e.contentRect, target: e.target})
				}
			})
		},
		start: function () {
			var fns = this.state.getFieldNames()
			for (var fn of fns) {
				var field = this.state.fields[fn]
				if (field.store && field.sortable) {
					var jsId = new lfJsId(this, fn)
					var params = {jsId: jsId, name: fn, $ref: null}
					this._filters[fn] = new ListFilter(this, this.state, params)
				}
			}
			return this._super.apply(this,arguments);
		},
		_notifyDomainUpdated: function () {
			this.trigger_up('search_filter_domain_updated', {
				domain: this.getDomain(),
			})
		},
		getDomain: function () {
			var domain = []
			for (var k of _.keys(this.state.fields)) {
				if (!_.isEmpty(this._filter_domain[k])) {
					domain.push([k, 'in', this._filter_domain[k]])
				}
			}
			return domain
		},
		_onUpdateDomain: function (ev) {
			var name = ev.data.name
			var values = ev.data.values
			this._filter_domain[name] = values
			this._notifyDomainUpdated();
			console.debug(`current filter domain is`, this._filter_domain)
		},
		initFilters: function () {
			this._filters = Object.create(null)
			this._filter_domain = {}
			for (var k of _.keys(this.state.fields)) {
				this._filter_domain[k] = []
			}

		},
		_renderHeaderCell: function (node) {
			var $th = this._super(node)
			const {name} = node.attrs
			var filter = this._filters[name];
			if (!filter) {
				return $th;
			}
			if ($th[0].innerHTML.length && this._hasVisibleRecords(this.state)) {
				const filterHandle = document.createElement('span')
				filterHandle.classList = 'o_filter'
				filterHandle.onclick = this._onClickFilter.bind(this)
				$th.prepend(filterHandle)
			}
			$th.addClass('o_column_filterable')
			filter.setRef($th)
			this.observer.observe($th[0]);
			return $th
		},
		destroy: function () {
			this.observer.disconnect();
			this._super.apply(this, arguments);
		},
		_onClickFilter: function (ev) {
			ev.preventDefault()
			ev.stopPropagation()
			var $node = $(ev.currentTarget).closest('th')
			var data = $node.data()
			if (this._filter instanceof Widget) {
				var isInDOM = this._filter.isInDOM
				this._filter.detach()
				if (this._filter.name === data.name && isInDOM) {
					return
				}
			}
			if (this._filters[data.name] instanceof Widget) {
				this._filter = this._filters[data.name]
			}
			this._filter.appendTo('body')

		},
	})
	return ListRenderer
})