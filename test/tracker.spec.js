'use strict';

var Lab = require('lab');
var Promise = require('bluebird');
var lab = Lab.script();
var expect = Lab.expect;
var describe = lab.describe;
var before = lab.before;
var beforeEach = lab.beforeEach;
var afterEach = lab.afterEach;
var after = lab.after;
var it = lab.it;
var tracker = require('../dist/tracker').default;
var knex = require('knex');
var knexPackage = require('knex/package.json');
var MockSymbol = require('../dist/util/transformer').MockSymbol;

function noop() {}

describe('Mock DB : ', function mockKnexTests() {
  var db;
  var mod = require('../');

  describe('Module', function moduleTests() {
    it('should have a getTracker method', function getTrackerEntry(done) {
      expect(mod.getTracker).to.be.a('function');
      done();
    });

    it('should return an instance of the tracker', function returnsTracker(done) {
      expect(tracker).to.equal(mod.getTracker());
      done();
    });

    it('should have an mock method', function mockAdapterEntry(done) {
      expect(mod.mock).to.be.a('function');
      done();
    });

    it('should have an unmock method', function mockAdapterEntry(done) {
      expect(mod.unmock).to.be.a('function');
      done();
    });

    it('should revert a single adapter back to the original', function revertSingle(done) {
      db = knex({
        dialect: 'sqlite3',
        connection: {
          filename: './data.db'
        },
        pool: {
          min: 0,
          max: 7,
        },
        useNullAsDefault: true,
      });

      const run = () => {
        return db.raw('select sqlite_version() as version;');
      }

      mod.mock(db);

      expect(db[MockSymbol]).to.be.a('object');

      run()
      .then((result) => {
        expect(result).to.be.undefined;

        mod.unmock(db);

        expect(db[MockSymbol]).to.be.undefined;

        return db.raw('select sqlite_version() as version;');
      })
      .then((result) => {
        expect(result).to.be.a('array');
        expect(result[0]).to.be.a('object');
        expect(result[0].version).to.be.a('string');
        done();
      }).catch(done);
    });
  });

  describe('Tracker', function trackerTests() {
    before(function beforeTracker(done) {
      db = knex({
        dialect: 'sqlite3',
        connection: {
          filename: './data.db'
        },
        useNullAsDefault: true
      });

      mod.mock(db);

      done();
    });

    beforeEach(function beforeEach(done) {
      tracker.install();
      done();
    });

    afterEach(function afterEach(done) {
      tracker.uninstall();
      done();
    });

    it('should not track if not installed', function trackOnlyWhenInstalled(done) {
      tracker.uninstall();
      db('users').select().then(function() {
        expect(tracker.queries.count()).to.equal(0);
        done();
      });
    });

    it('should track if installed', function trackWhenInstalled(done) {
      tracker.once('query', function gotQuery(query) {
        expect(tracker.queries.count()).to.equal(1);
        done();
      });

      db('users').select().then(noop);
    });

    it('uninstall should stop tracking', function trackWhenInstalled(done) {
      expect(tracker.tracking).to.equal(true);

      tracker.uninstall();

      expect(tracker.tracking).to.equal(false);

      done();
    });

    it('should return a query object with a response method',
    function queryHasResponse(done) {
      tracker.install();

      tracker.once('query', function gotQuery(query) {
        expect(query).to.have.property('response');
        expect(query.response).to.be.a('function');
        expect(query.reject).to.be.a('function');
        expect(query.transacting).to.be.a('boolean');
        done();
      });

      db('users').select().then(noop);
    });

    it('should return a query object with a method property',
    function queryHasMethod(done) {
      tracker.once('query', function gotQuery(query) {
        expect(query).to.have.property('method');
        expect(query.method).to.be.a('string');
        tracker.uninstall();
        done();
      });

      db('users').select().then(noop);
    });

    it('should return a query object with a bindings property',
    function queryHasBindings(done) {
      tracker.once('query', function gotQuery(query) {
        expect(query).to.have.property('bindings');
        expect(query.bindings).to.be.a('array');
        done();
      });

      db('users').select().then(noop);
    });

    it('should return a query object with a sql property',
    function queryHasSql(done) {
      tracker.once('query', function gotQuery(query) {
        expect(query).to.have.property('sql');
        expect(query.sql).to.be.a('string');
        tracker.uninstall();
        done();
      });

      db('users').select().then(noop);
    });

    it('should be able to get the first query',
    function queryHasResponse(done) {
      tracker.on('query', function gotQuery(query, step) {
        query.index = step;

        if (step === 3) {
          expect(tracker.queries.first().index).to.equal(1);
          tracker.uninstall();
          done();
        }
      });

      db('users').select().then(noop);
      db('users').select().then(noop);
      db('users').select().then(noop);
    });

    it('should be able to get the last query',
    function queryHasResponse(done) {
      tracker.on('query', function gotQuery(query, step) {
        query.index = step;

        if (step === 3) {
          expect(tracker.queries.last().index).to.equal(3);
          tracker.uninstall();
          done();
        }
      });

      db('users').select().then(noop);
      db('users').select().then(noop);
      db('users').select().then(noop);
    });

    it('should be able to get a query at a specific step',
    function queryHasResponse(done) {
      tracker.on('query', function gotQuery(query, step) {
        query.index = step;

        if (step === 3) {
          expect(tracker.queries.step(2).index).to.equal(2);
          tracker.uninstall();
          done();
        }
      });

      db('users').select().then(noop);
      db('users').select().then(noop);
      db('users').select().then(noop);
    });

    it('should pass a step parameters to the query event',
    function queryHasResponse(done) {
      var index = 1;

      tracker.on('query', function gotQuery(query, step) {
        expect(step).to.equal(index);

        ++index;

        if (step === 3) {
          tracker.uninstall();
          done();
        }
      });

      db('users').select().then(noop);
      db('users').select().then(noop);
      db('users').select().then(noop);
    });

    it('should reply with the data passed to the query#response', function responseTest(done) {
      tracker.on('query', function checkResult(query) {
        query.response({ works : true });
      });

      db.select('field').from('table').then(function testResponse(result) {
        expect(result).to.be.a('object');
        expect(result.works).to.equal(true);
        done();
      });
    });

    it('query#reject', function responseTest(done) {
      tracker.on('query', function checkResult(query) {
        query.reject('i threw up');
      });

      db.select('field').from('table').catch(function(error) {
        expect(error.message).to.be.a('string');
        expect(error.message).to.equal('select "field" from "table" - i threw up');
        done();
      });
    });

    describe('Knex', function knexTests() {
      it('should support schema#hasTable', function createTableTest(done) {
        tracker.on('query', function checkResult(query) {
          expect(query.sql).to.be.a('string');
          expect(query.sql).to.equal('select * from sqlite_master where type = \'table\' and name = ?');
          done();
        });

        db.schema.hasTable('testing').then(noop);
      });

      it('should support knex#Raw', function createTableTest(done) {
        tracker.on('query', function checkResult(query) {
          expect(query.method).to.equal('raw');
          query.response([
            {
              fielda : 'A',
              fieldb : 'B'
            },
            {
              fielda : 'C',
              fieldb : 'D'
            },
            {
              fielda : 'E',
              fieldb : 'F'
            }
          ]);
        });

        db.raw('SELECT fielda, fieldb FROM table;').then(function checkFirstArrResults(rows) {
          expect(rows).to.be.a('array');
          expect(rows[0]).to.be.a('object');
          expect(rows[1]).to.be.a('object');
          expect(rows[2]).to.be.a('object');
          expect(rows[0].fielda).to.equal('A');
          expect(rows[1].fielda).to.equal('C');
          expect(rows[2].fielda).to.equal('E');
          done();
        });
      });

      it('should support knex#first method with array response', function firstArrTest(done) {
        tracker.on('query', function checkResult(query) {
          expect(query.method).to.equal('first');
          query.response([
            {
              fielda : 'A',
              fieldb : 'B'
            },
            {
              fielda : 'C',
              fieldb : 'D'
            },
            {
              fielda : 'E',
              fieldb : 'F'
            }
          ]);
        });

        db.table('table').first('fielda', 'fieldb').then(function checkFirstArrResults(model) {
          expect(model.fielda).to.equal('A');
          expect(model.fieldb).to.equal('B');
          done();
        });
      });

      it('should support knex#count', function firstArrTest(done) {
        tracker.on('query', function checkResult(query) {
          expect(query.method).to.equal('select');
          expect(query.sql).to.equal('select count(*) from "table"');

          query.response({
            count : 10,
          });
        });

        db.table('table').count().then(function checkCountResults(model) {
          expect(model).to.be.a('object');
          expect(model.count).to.equal(10);
          done();
        });
      });

      it('should support knex#first method with object response', function firstObjTest(done) {
        tracker.on('query', function checkResult(query) {
          expect(query.method).to.equal('first');
          query.response(
            {
              fielda : 'A',
              fieldb : 'B'
            }
          );
        });

        db.table('table').first('fielda', 'fieldb').then(function checkFirstArrResults(model) {
          expect(model.fielda).to.equal('A');
          expect(model.fieldb).to.equal('B');
          done();
        });
      });

      it('should support knex#pluck method with array response', function firstArrTest(done) {
        tracker.on('query', function checkResult(query) {
          expect(query.method).to.equal('pluck');
          query.response([
            {
              fielda : 'A',
              fieldb : 'B'
            },
            {
              fielda : 'C',
              fieldb : 'D'
            },
            {
              fielda : 'E',
              fieldb : 'F'
            }
          ]);
        });

        db.table('table').pluck('fielda').then(function checkFirstArrResults(arr) {
          expect(arr[0]).to.equal('A');
          expect(arr[1]).to.equal('C');
          expect(arr[2]).to.equal('E');
          done();
        });
      });

      it('should support knex#truncate method', function trunecateTest(done) {
        tracker.on('query', function checkResult(query) {
          expect(query.method).to.equal('truncate');
          done();
        });

        db.table('table').truncate().then(noop);
      });

      it('should support knex#del method', function deleteTest(done) {
        tracker.on('query', function checkResult(query) {
          expect(query.method).to.equal('del');
          done();
        });

        db.table('table').delete().then(noop);
      });

      it('should support knex#stream method', function streamTest(done) {
        tracker.on('query', function checkResult(query) {
          expect(query.method).to.equal('select');
          query.response([
            {
              columnA : true,
              columnB : 'testing',
              columnC : 1,
            },
          ], {
            stream : true,
          });
        });

        var stream = db.select('columnA', 'columnB', 'columnC')
                       .from('field')
                       .where({
                         'columnA': true
                       })
                       .stream();


        stream.on('data', function(result) {
          expect(result).to.be.a('object');
          expect(result.columnC).to.equal(1);
          expect(result.columnB).to.equal('testing');
          expect(result.columnA).to.equal(true);
          done();
        });
      });

      it('should catch errors on stream', function streamTest(done) {
        tracker.on('query', function checkResult(query) {
          throw new Error('Third Error');
        });

        var stream = db.select('columnA', 'columnB', 'columnC')
        .from('field')
        .where({
          'columnA': true
        })
        .stream(noop)
        .catch(function streamError(err) {
          expect(err).to.be.an.instanceof(Error);
          expect(err.message).to.equal('Third Error')
          done();
        });
      });

      it('should support transactions (commit)', function(done) {
        tracker.on('query', function checkResult(query, step) {
          var sql = query.sql.toLowerCase();

          expect(query.transacting).to.be.true;

          if (query.method === 'insert') {
            return query.response(1);
          }

          switch (step) {
            case 1:
              expect(sql).to.contain('begin');
              query.response([]);
              break;

            case 6:
              expect(sql).to.contain('commit');
              query.response([]);
              break;
          }

          if (sql.indexOf('rollback') !== -1) {
            query.response([]);
          }
        });

        // Using trx as a transaction object:
        db.transaction(function(trx) {
          var books = [
            {title: 'Canterbury Tales'},
            {title: 'Moby Dick'},
            {title: 'Hamlet'}
          ];

          db.insert({name: 'Old Books'}, 'id')
            .into('catalogues')
            .transacting(trx)
            .then(function(ids) {
              return Promise.map(books, function(book) {
                book.catalogue_id = ids[0];

                return db.insert(book).into('books').transacting(trx);
              });
            }).then(trx.commit)
              .catch(trx.rollback);
          }).then(function(inserts) {
            expect(inserts.length).to.equal(3);
            done();
          }).catch(function(error) {
            done(error);
          });
      });

      it('should support transactions (rollback)', function(done) {
        tracker.on('query', function checkResult(query, step) {
          var sql = query.sql.toLowerCase();

          if (query.method === 'insert') {
            return query.response(1);
          }

          switch (step) {
            case 1:
              expect(sql).to.contain('begin');
              query.response([]);
              break;

            case 6:
              expect(sql).to.contain('commit');
              query.response([]);
              break;
          }

          if (sql.indexOf('rollback') !== -1) {
            query.response([]);
          }
        });

        // Using trx as a transaction object:
        db.transaction(function(trx) {
          var books = [
            {title: 'Canterbury Tales'},
            {title: 'Moby Dick'},
            {title: 'Hamlet'}
          ];

          db.insert({name: 'Old Books'}, 'id')
            .into('catalogues')
            .transacting(trx)
            .then(function(ids) {
              throw new Error('testing');

              return Promise.map(books, function(book) {
                book.catalogue_id = ids[0];

                return db.insert(book).into('books').transacting(trx);
              });
            }).then(trx.commit)
              .catch(trx.rollback);
          }).then(function(inserts) {
            expect(inserts.length).to.equal(3);
            done('transaction should have failed');
          }).catch(function(error) {
            done();
          });
      });
  });

    describe('Bookshelf', function bookshelfTests() {
      var Model;
      var Collection;

      before(function before(done) {
        var bookshelf = require('bookshelf')(db);

        Model = bookshelf.Model.extend({
          tableName : 'models'
        });

        Collection = bookshelf.Collection.extend({
          model : Model
        });

        done();
      });

      beforeEach(function beforeEach(done) {
        tracker.install();
        done();
      });

      afterEach(function afterEach(done) {
        tracker.uninstall();
        done();
      });

      describe('Models', function modelTests() {
        it('should work with Model#fetch', function modelFetchTest(done) {
          tracker.on('query', function sendResult(query) {
            query.response([
              {
                id : 1,
                foo : 'bar'
              }
            ]);
          });

          Model.forge({ id : 1 }).fetch()
               .then(function fetchResult(model) {
                 expect(model).to.be.an.instanceof(Model);
                 expect(model.get('id')).to.equal(1);
                 expect(model.get('foo')).to.equal('bar');
                 done();
               });
        });

        it('should work with Model#fetchAll', function modelFetchAllTest(done) {
          tracker.on('query', function sendResult(query) {
            query.response([
              {
                id : 1,
                foo : 'bar'
              },
              {
                id : 2,
                foo : 'baz'
              }
            ]);
          });

          Model.forge({ id : 1 }).fetchAll()
            .then(function fetchAllResult(collection) {
              expect(collection.length).to.equal(2);
              expect(collection.models[0].get('foo')).to.equal('bar');
              expect(collection.models[1].get('foo')).to.equal('baz');

              done();
            });
        });

        it('should work with Model#count', function modelCountTest(done) {
          tracker.on('query', function sendResult(query) {
            expect(query.sql).to.equal('select count("count") as "count" from "models" where "color" = ?');
            expect(query.method).to.equal('select');

            query.response([{
              count : 10,
            }]);
          });

          Model.forge()
          .where('color', 'blue')
          .count('count')
          .then(function countResult(count) {
              expect(count).to.equal(10);
              done();
            });
        });

        it('should work with Model#save update with transaction', function modelsaveUpdateTest(done) {
          var bookshelf = require('bookshelf')(db);

          tracker.on('query', function sendResult(query, step) {
            switch (step) {
              case 1:
                expect(query.sql.toLowerCase()).to.equal('begin;');
                query.response([]);
                break;
              case 2:
                expect(query.method).to.equal('update');
                expect(query.bindings).to.include('bar');
                expect(query.bindings).to.include(10);
                query.response([])
                break;
              case 3:
                expect(query.sql.toLowerCase()).to.equal('commit;');
                query.response([]);
                break;
            }
          });

          bookshelf.transaction(function bookshelfTransaction(trx) {
            return Model.forge({ id : 10, foo : 'bar' }).save(null, {
              transacting : trx,
            }).then(function(model) {
              expect(model.get('id')).to.equal(10);
              expect(model.get('foo')).to.equal('bar');
            }).asCallback(done);
          });
        });

        it('should work with Model#save on updates', function modelsaveUpdateTest(done) {
          tracker.on('query', function sendResult(query) {
            expect(query.method).to.equal('update');
            expect(query.bindings).to.include('bar');
            expect(query.bindings).to.include(10);
            done();
          });

          Model.forge({ id : 10, foo : 'bar' }).save();
        });

        it('should work with Model#save on inserts', function modelSaveInsertTest(done) {
          tracker.on('query', function sendResult(query) {
            expect(query.method).to.equal('insert');
            expect(query.bindings).to.include('bar');
            done();
          });

          Model.forge({ foo : 'bar' }).save();
        });

        it('should work with Model#destroy', function modelDestroyTest(done) {
          tracker.on('query', function sendResult(query) {
            expect(query.method).to.equal('del');
            done();
          });

          Model.forge({ id : 1, foo : 'bar' }).destroy();
        });
      });

      describe('Collections', function collectionTests() {
        it('should work with Collection#fetch method', function collFetchTest(done) {
          tracker.on('query', function sendResult(query) {
            query.response([
              {
                id : 1,
                foo : 'bar'
              },
              {
                id : 2,
                foo : 'baz'
              }
            ]);
          });

          Collection.forge().fetch()
                            .then(function fetchResult(collection) {
                              expect(collection.length).to.equal(2);
                              expect(collection.models[0].get('foo')).to.equal('bar');
                              expect(collection.models[1].get('foo')).to.equal('baz');

                              done();
                            });
        });

        it('should work with Collection#fetchOne method', function collFetchOne(done) {
          tracker.on('query', function sendResult(query) {
            expect(query.bindings[0]).to.equal(2);
            expect(query.bindings[1]).to.equal(1);

            done();
          });

          Collection.forge().query({
            where : {
              id : 2
            }
          }).fetchOne();
        });
      });
    });
  });
});

module.exports.lab = lab;
