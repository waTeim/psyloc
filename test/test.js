"use strict";

let apiHost = "api-dev.esecuresend.com";
let website = "dev.esecuresend.com";

if(process.env.platform == "prod")
{
  apiHost = "api.esecuresend.com";
  website = "www.esecuresend.com";
}

const psyloc = require('..')("localhost",apiHost,website);
const Promise = require('bluebird');
const chai = require('chai');
const expect = chai.expect;

const sleep = Promise.promisify(function(millis,done) { setTimeout(done,millis) });

const addFiles = Promise.coroutine(function*(fileSpecList,externalTransactionID,token,keys,peers,torrentName)
{
  try 
  {
    let x = yield psyloc.addFiles(fileSpecList,externalTransactionID,token,keys,peers,torrentName);

    yield sleep(1000);
    return x;
  }
  catch(e) { return null; }
});

describe('Regression Tests',function()
{
  it('get identity',function(done)
  {
    psyloc.getServerIdentity().then(function(res)
    {
      try
      {
        expect(res).to.not.equal(null);
        expect(res.identity).to.not.equal(undefined);
        expect(res.identity.agent).to.not.equal(undefined);
        expect(res.identity.hostId).to.not.equal(undefined);
        expect(res.identity.uuid).to.not.equal(undefined);
        done();
      }
      catch(e) { done(e); }
    });
  });
  it('get bootstrap token',function(done)
  {
    psyloc.getToken().then(function(res) 
    {
      try
      {
        expect(res).to.not.equal(null);
        expect(res.success).to.equal(true);
        expect(res.info).to.not.eql(undefined);
        expect(res.info.id).to.not.eql(undefined);
        done();
      }
      catch(e) { done(e); }
    });
  });
  it('add a file',function(done)
  {
    addFiles([__dirname + "/testfile.x"]).then(function(res)
    {
      try
      {
        expect(res).to.not.equal(null);
        expect(res.success).to.equal(true);
        done();
      }
      catch(e) { done(e); }
    });
  });
  it('delete a torrent',function(done)
  {
    psyloc.deleteTorrent("418068C921DCB9902BACD2B3B27A0E5A6A008EDC").then(function(res)
    {
      try
      {
        expect(res).to.not.equal(null);
        expect(res.success).to.equal(true);
        done();
      }
      catch(e) { done(e); }
    });
  });
  it('get groups',function(done)
  {
    psyloc.getGroups().then(function(res)
    {
      try
      {
        expect(res).to.not.equal(null);
        expect(res.success).to.equal(true);
        done();
      }
      catch(e) { done(e); }
    });
  });
  it('find psylo integration group',function(done)
  {
    psyloc.findGroup("PSYLO INTEGRATION").then(function(res)
    {
      try
      {
        expect(res).to.not.equal(null);
        expect(res.label).to.equal("PSYLO INTEGRATION");
        expect(res.id).to.not.equal(undefined);
        done();
      }
      catch(e) { done(e); }
    });
  });
  it('get psylo integration channels',function(done)
  {
    psyloc.getChannels("PSYLO INTEGRATION").then(function(res)
    {
      try
      {
        expect(res).to.not.equal(null);
        expect(res.success).to.equal(true);
        done();
      }
      catch(e) { done(e); }
    });
  });
  it('find channel send to ub0',function(done)
  {
    psyloc.findChannel("PSYLO INTEGRATION","send to ub0").then(function(res)
    {
      try
      {
        expect(res).to.not.equal(null);
        expect(res.label).to.equal("send to ub0");
        expect(res.id).to.not.equal(undefined);
        done();
      }
      catch(e) { done(e); }
    });
  });
  it('send file',function(done)
  {
    let path = __dirname + "/testfile.x";

    psyloc.sendViaChannel("PSYLO INTEGRATION","send to ub0",path).then(function(res)
    {
      try
      {
        expect(res).to.not.equal(null);
        done();
      }
      catch(e) { done(e); }
    });
  });
});
