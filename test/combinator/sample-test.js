require('buster').spec.expose();
var expect = require('buster').expect;

var sample = require('../../lib/combinator/sample');
var sampleWith = require('../../lib/combinator/sample').sampleWith;
var periodic = require('../../lib/source/periodic').periodic;
var take = require('../../lib/combinator/slice').take;
var map = require('../../lib/combinator/transform').map;
var scan = require('../../lib/combinator/accumulate').scan;
var reduce = require('../../lib/combinator/accumulate').reduce;
var observe = require('../../lib/combinator/observe').observe;
var core = require('../../lib/source/core');

var TestScheduler = require('../helper/TestScheduler');

var empty = core.empty;
var streamOf = core.of;

var sentinel = { value: 'sentinel' };

function inc(x) {
	return x+1;
}

function append(a, x) {
	return a.concat([x]);
}

describe('sample', function() {
	it('should be empty if sampler is empty', function() {
		var spy = this.spy();
		var s = sample.sample(spy, empty(), streamOf(sentinel), streamOf(123));

		var observer = this.spy();
		return observe(observer, s)
			.then(function() {
				expect(spy).not.toHaveBeenCalled();
				expect(observer).not.toHaveBeenCalled();
			});
	});

	it('should sample latest value', function() {
		var s1 = scan(inc, 0, periodic(2));
		var s2 = scan(inc, 0, periodic(1));

		var s = sample.sample(Array, periodic(1), s1, s2);

		var scheduler = new TestScheduler();
		scheduler.tick(5);

		return scheduler.collect(take(5, s))
			.then(function(events) {
				expect(events).toEqual([
					{ time: 0, value: [1, 1] },
					{ time: 1, value: [1, 2] },
					{ time: 2, value: [2, 3] },
					{ time: 3, value: [2, 4] },
					{ time: 4, value: [3, 5] }
				]);
			});
	});

	it('should repeat last value after source ends', function() {
		var s = sample.sample(Array, periodic(1), streamOf(sentinel), streamOf(123));

		return observe(function(x) {
			expect(x).toEqual([sentinel, 123]);
		}, take(3, s));
	});
});

describe('sampleWith', function() {
	it('should be empty if sampler is empty', function() {
		var s = sample.sampleWith(empty(), streamOf(sentinel));

		return reduce(function (x) {
			return x+1;
		}, 0, s)
			.then(function(x) {
				expect(x).toBe(0);
			});
	});

	it('should sample latest value', function() {
		var n = 5;
		var i = 0;
		var s = sampleWith(take(n, periodic(2)), map(function() {
			return i++;
		}, periodic(1)));

		var scheduler = new TestScheduler();
		scheduler.tick(n*21);

		return scheduler.collect(s)
			.then(function(events) {
				expect(events).toEqual([
					{ time: 0, value: 0 },
					{ time: 2, value: 1 },
					{ time: 4, value: 3 },
					{ time: 6, value: 5 },
					{ time: 8, value: 7 }
				]);
			});
	});

	it('should sample latest value', function() {
		var n = 6;
		var i = 0;
		var s = sampleWith(take(n, periodic(1)), map(function() {
			return i++;
		}, periodic(2)));

		var scheduler = new TestScheduler();
		scheduler.tick(n);

		return scheduler.collect(s)
			.then(function(events) {
				expect(events).toEqual([
					{ time: 0, value: 0 },
					{ time: 1, value: 0 },
					{ time: 2, value: 1 },
					{ time: 3, value: 1 },
					{ time: 4, value: 2 },
					{ time: 5, value: 2 }
				]);
			});
	});

	it('should repeat last value after source ends', function() {
		var n = 3;
		var s = sample.sampleWith(take(n, periodic(1)), streamOf(sentinel));

		var scheduler = new TestScheduler();
		scheduler.tick(n);

		return scheduler.collect(s)
			.then(function(events) {
				expect(events).toEqual([
					{ time: 0, value: sentinel },
					{ time: 1, value: sentinel },
					{ time: 2, value: sentinel }
				]);
			});
	});
});
