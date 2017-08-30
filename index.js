"use strict";

const fs = require('fs');
const request = require('request');
const Promise = require('bluebird');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function getCredentials()
{
  var password;
  var username;
  var homeDir;

  if(process.env.HOMEPATH) homeDir = process.env.HOMEDRIVE + process.env.HOMEPATH;
  else homeDir = process.env.HOME;

  var lines = fs.readFileSync(homeDir + "/.dgd/pw").toString().replace(/\r/g,"").split('\n');

  for(var i = 0;i < lines.length;i++)
  {
    var lineComponent = lines[i].split(' ');

    if(lineComponent[0].split('@')[1] == 'localhost')
    {
      username = lineComponent[0].split('@')[0];
      password = lineComponent[1];
    }
  }
  return { username:username, password:password};
}

function mkPsyloGetRequest(url,callback)
{
  request.get({ url:url },function(err,res,body)
  {
    let parsed = JSON.parse(body);

    callback(err,parsed);
  });
}

function mkPsyloPostRequest(url,body,auth,callback)
{
  let postObj = { url:url, json:true, body:body };

  if(auth == null) auth = getCredentials();
  if(auth != null)
  {
    let token = auth.username + ":" + auth.password;
    let encoding = new Buffer(token).toString('base64');

    postObj.headers =
    {
      Authorization: "xBasic " + encoding
    };
  }
  request.post(postObj,function(err,res,body) { callback(err,body); });
}

function mkESSRequest(url,body,callback)
{
  let postObj = { url:url, json:true, body:body };

  request.post(postObj,function(err,res,body) { callback(err,body); });
}

const addFilesRequest = Promise.promisify(function(url,body,auth,callback) { mkPsyloPostRequest(url + 'addFiles',body,auth,callback); });
const deleteTorrentRequest = Promise.promisify(function(url,body,auth,callback) { mkPsyloPostRequest(url + 'deleteTorrent',body,auth,callback); });
const getChannelsRequest = Promise.promisify(function(url,body,callback) { mkESSRequest(url + 'console/services/group/channels',body,callback); });
const getGroupsRequest = Promise.promisify(function(url,body,callback) { mkESSRequest(url + 'console/services/group/list',body,callback); });
const getServerIdentity = Promise.promisify(function(url,callback) { mkPsyloGetRequest(url + 'getServerIdentity',callback); });
const getTokenRequest = Promise.promisify(function(url,body,auth,callback) { mkPsyloPostRequest(url + 'getToken',body,auth,callback); });
const getTorrentInfoRequest = Promise.promisify(function(url,body,auth,callback) { mkPsyloPostRequest(url + 'getTorrentInfo',body,auth,callback); });
const getTorrentListRequest = Promise.promisify(function(url,body,auth,callback) { mkPsyloPostRequest(url + 'getTorrentList',body,auth,callback); });
const getTransactionRequest = Promise.promisify(function(url,body,callback) { mkESSRequest(url + 'console/services/ext/xl/create',body,callback); });
const preFlightRequest = Promise.promisify(function(url,body,auth,callback) { mkPsyloPostRequest(url + 'preFlight',body,auth,callback); });

const addFiles = Promise.coroutine(function*(url,fileSpecList,transactionId,token,keys,peers,torrentName,auth)
{ 
  let body = { fileSpecList:fileSpecList };

  if(transactionId != null) body.externalTransactionID = transactionId;
  if(token != null) body.token = token;
  if(keys != null) body.keys = keys;
  if(peers != null) body.peers = peers;
  if(torrentName != null) body.torrentName = torrentName;
  return yield addFilesRequest(url,body,auth);
});

const checkSend = Promise.coroutine(function*(url,fileSpecList,isEncrypted,auth) { return yield preFlightRequest(url,{ fileSpecList:fileSpecList, isEncrypted:isEncrypted },auth); });
const checkReceive = Promise.coroutine(function*(url,sourceSize,isEncrypted,auth) { return yield preFlightRequest(url,{ sourceSize:sourceSize, isEncrypted:isEncrypted },auth); });

const getTransaction = Promise.coroutine(function*(url,site,token,groupId,channelId,serverIdentity,fileInfo)
{
  let credentials =
  { 
    token:token,
    uuid:serverIdentity.uuid,
    hostid:serverIdentity.hostId
  };
  let transaction =
  { 
    groupMaskId:groupId,
    channelIds:[ channelId ],
    recipientIds:[],
    files:[ { fileName:fileInfo.path, fileSize:"" + fileInfo.size }],
    memoTitle:"test",
    encrypted:false
  }
  let body = { credentials:credentials, transaction:transaction };

  return yield getTransactionRequest(url,body);
});

const deleteTorrent = Promise.coroutine(function*(url,infoHash,auth) { return yield deleteTorrentRequest(url,{ infoHash:infoHash },auth); });

const getChannels = Promise.coroutine(function*(url,token,groupId)
{ 
  return yield getChannelsRequest(url,{ credentials:{ token:token }, groupMaskId:groupId });
});

const getFileInfo = Promise.coroutine(function*(path)
{
  let fileInfo = yield stat(path);

  fileInfo.path = path;
  return fileInfo;
});

const getGroups = Promise.coroutine(function*(url,site,token) { return yield getGroupsRequest(url,{ credentials:{ token:token }, target:site}); });
const getToken = Promise.coroutine(function*(url,infoHash,auth) { return yield getTokenRequest(url,{},auth); });
const getTorrentInfo = Promise.coroutine(function*(url,infoHash,auth) { return yield getTorrentInfoRequest(url,{ infoHash:infoHash },auth); });
const getTorrentList = Promise.coroutine(function*(url,auth) { return yield getTorrentListRequest(url,{},auth); });

const stat = Promise.promisify(fs.stat);

module.exports = function(psyHost,apiHost,website)
{
  const _addFiles = Promise.coroutine(function*(fileSpecList,externalTransactionID,token,keys,peers,torrentName)
  {
    try { return yield addFiles("https://" + psyHost + ":20001/",fileSpecList,externalTransactionID,token,keys,peers,torrentName); }
    catch(e) { return null; }
  });

  const _checkReceive = Promise.coroutine(function*()
  {
    try { return yield checkReceive("https://" + psyHost + ":20001/"); }
    catch(e) { return null; }
  });

  const _checkSend = Promise.coroutine(function*()
  {
    try { return yield checkSend("https://" + psyHost + ":20001/"); }
    catch(e) { return null; }
  });

  const _deleteTorrent = Promise.coroutine(function*(infoHash)
  {
    try { return yield deleteTorrent("https://" + psyHost + ":20001/",infoHash); }
    catch(e) { return null; }
  });

  const _findChannel = Promise.coroutine(function*(groupName,channelName,tokenInfo)
  {
    try
    {
      if(tokenInfo == null) tokenInfo = yield _getToken();

      let channels = yield _getChannels(groupName,tokenInfo);

      if(channels == null || channels.labelValues == null) return null;
      for(let i = 0;i < channels.labelValues.length;i++)
      {
         if(channels.labelValues[i].label == channelName) return channels.labelValues[i];
      }
      return null;
    }
    catch(e) { return null; }
  });

  const _findGroup = Promise.coroutine(function*(groupName,tokenInfo)
  {
    try
    {
      if(tokenInfo == null) tokenInfo = yield _getToken();

      let groups = yield _getGroups(tokenInfo);

      if(groups == null || groups.labelValues == null) return null;
      for(let i = 0;i < groups.labelValues.length;i++)
      {
         if(groups.labelValues[i].label == groupName) return groups.labelValues[i];
      }
      return null;
    } 
    catch(e) { return null; }
  });

  const _getChannels = Promise.coroutine(function*(groupName,tokenInfo)
  {
    try
    {
      if(tokenInfo == null) tokenInfo = yield _getToken();

      let groupInfo = yield _findGroup(groupName,tokenInfo);

      if(groupInfo == null) return null;
      return yield getChannels("https://" + apiHost + "/",tokenInfo.info.id,groupInfo.id);
    }
    catch(e) { return null; }
  });

  const _getGroups = Promise.coroutine(function*(tokenInfo)
  {
    try
    {
      if(tokenInfo == null) tokenInfo = yield _getToken();
      if(tokenInfo == null || tokenInfo.info == null || tokenInfo.info.id == null) return null;
      return yield getGroups("https://" + apiHost + "/",website,tokenInfo.info.id);
    }
    catch(e) { return null; }
  });


  const _getServerIdentity = Promise.coroutine(function*()
  {
    try { return yield getServerIdentity("https://" + psyHost + ":20001/"); }
    catch(e) { return null; }
  });

  const _getToken = Promise.coroutine(function*()
  {
    try { return yield getToken("https://" + psyHost + ":20001/"); }
    catch(e) { return null; }
  });

  const _getTorrentInfo = Promise.coroutine(function*(infoHash)
  {
    try { return yield getTorrentInfo("https://" + psyHost + ":20001/",infoHash); }
    catch(e) { return null; }
  });

  const _getTorrentList = Promise.coroutine(function*()
  {
    try { return yield getTorrentList("https://" + psyHost + ":20001/"); }
    catch(e) { return null; }
  });

  const _getTransactionForChannelSend = Promise.coroutine(function*(groupName,channelName,path,tokenInfo)
  {
    try
    {
      if(tokenInfo == null) tokenInfo = yield _getToken();

      let serverIdentity = yield _getServerIdentity();
      let fileInfo = yield getFileInfo(path);
      let groupInfo = yield _findGroup(groupName,tokenInfo);

      if(groupInfo == null) return null;

      let channels = yield getChannels("https://" + apiHost + "/",tokenInfo.info.id,groupInfo.id);
      let channelInfo;

      if(channels == null || channels.labelValues == null) return null;
      for(let i = 0;i < channels.labelValues.length;i++)
      {
         if(channels.labelValues[i].label == channelName) channelInfo = channels.labelValues[i];
      }
      if(channelInfo == null) return null;
      return yield getTransaction("https://" + apiHost + "/",website,tokenInfo.info.id,groupInfo.id,channelInfo.id,serverIdentity.identity,fileInfo);
    }
    catch(e) { return null; }
  });

  const _sendViaChannel = Promise.coroutine(function*(groupName,channelName,path)
  {
    let tokenInfo = yield _getToken();
    let transactionInfo = yield _getTransactionForChannelSend(groupName,channelName,path,tokenInfo);
    return yield _addFiles([ path ],transactionInfo.transactions[0].transactionId,tokenInfo.info.id,transactionInfo.keys,transactionInfo.peers);
  });

  return {
    addFiles:_addFiles,
    checkSend:_checkSend,
    checkReceive:_checkReceive,
    deleteTorrent:_deleteTorrent,
    findChannel:_findChannel,
    findGroup:_findGroup,
    getChannels:_getChannels,
    getGroups:_getGroups,
    getFileInfo:getFileInfo,
    getServerIdentity:_getServerIdentity,
    getToken:_getToken,
    getTorrentInfo:_getTorrentInfo,
    getTorrentList:_getTorrentList,
    sendViaChannel:_sendViaChannel
  }
};
