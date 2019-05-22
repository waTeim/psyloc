"use strict";

const fs = require('fs');
const request = require('request');
const Promise = require('bluebird');
const path = require('path');
const winston = require('winston');
const moment = require('moment');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function getCredentials()
{
  let password;
  let username;
  let homeDir;

  if(process.env.HOMEPATH) homeDir = process.env.HOMEDRIVE + process.env.HOMEPATH;
  else homeDir = process.env.HOME;

  var lines = fs.readFileSync(homeDir + "/.dgd/pw").toString().replace(/\r/g,"").split('\n');

  for(let i = 0;i < lines.length;i++)
  {
    let lineComponents = lines[i].split(' ');

    if(lineComponents.length >= 2)
    {
      let c1 = lineComponents.splice(0,lineComponents.length - 1).join(' ');
      let c2 = c1.split('@');

      if(c2[1] == 'localhost')
      {
        username = c2[0];
        password = lineComponents[lineComponents.length - 1];
      }
    }
  }
  return { username:username, password:password};
}

const readdir = Promise.promisify(fs.readdir);
const stat = Promise.promisify(fs.stat);

const dirSize = Promise.coroutine(function*(dir)
{
  let files = yield readdir(dir);
  let sum = 0;

  for(let i = 0;i < files.length;i++)
  {
    let filePath = path.join(dir,files[i]);
    let stats = yield stat(filePath);

    if(stats.isDirectory()) sum += yield dirSize(filePath);
    else if(stats.isFile()) sum += stats.size;
  }
  return sum;
});

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
const completeMetafilesTaskRequest = Promise.promisify(function(url,body,callback) { mkESSRequest(url + 'console/services/ext/xl/meta/task/completed',body,callback); });
const deleteTorrentRequest = Promise.promisify(function(url,body,auth,callback) { mkPsyloPostRequest(url + 'deleteTorrent',body,auth,callback); });
const getChannelsRequest = Promise.promisify(function(url,body,callback) { mkESSRequest(url + 'console/services/group/channels',body,callback); });
const getGroupsRequest = Promise.promisify(function(url,body,callback) { mkESSRequest(url + 'console/services/group/list',body,callback); });
const getMetafilesTaskRequest = Promise.promisify(function(url,body,callback) { mkESSRequest(url + 'console/services/ext/xl/meta/tasks',body,callback); });
const getReceiversRequest = Promise.promisify(function(url,body,callback) { mkESSRequest(url + 'console/services/group/receivers',body,callback); });
const getServerIdentity = Promise.promisify(function(url,callback) { mkPsyloGetRequest(url + 'getServerIdentity',callback); });
const getTokenRequest = Promise.promisify(function(url,body,auth,callback) { mkPsyloPostRequest(url + 'getToken',body,auth,callback); });
const getTorrentInfoRequest = Promise.promisify(function(url,body,auth,callback) { mkPsyloPostRequest(url + 'getTorrentInfo',body,auth,callback); });
const getTorrentListRequest = Promise.promisify(function(url,body,auth,callback) { mkPsyloPostRequest(url + 'getTorrentList',body,auth,callback); });
const getTransactionRequest = Promise.promisify(function(url,body,callback) { mkESSRequest(url + 'console/services/ext/xl/create',body,callback); });
const getTransactionStatusRequest = Promise.promisify(function(url,body,callback) { mkESSRequest(url + 'console/services/ext/xl/get/transaction',body,callback); });
const getTransactionHistoryRequest = Promise.promisify(function(url,body,callback) { mkESSRequest(url + 'console/services/ext/xl/get/history',body,callback); });
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
const completeMetafilesTask = Promise.coroutine(function*(url,token,taskId) { return yield completeMetafilesTaskRequest(url,{ token:token, id:taskId }); });
const deleteTorrent = Promise.coroutine(function*(url,infoHash,auth) { return yield deleteTorrentRequest(url,{ infoHash:infoHash },auth); });
const getChannels = Promise.coroutine(function*(url,token,groupId) { return yield getChannelsRequest(url,{ credentials:{ token:token }, groupMaskId:groupId }); });

const getFileInfo = Promise.coroutine(function*(filePath)
{
  let stats = yield stat(filePath);

  stats.path = filePath;
  if(stats.isDirectory()) stats.size = yield dirSize(filePath);
  return stats;
});

const getGroups = Promise.coroutine(function*(url,site,token) { return yield getGroupsRequest(url,{ credentials:{ token:token }, target:site}); });
const getMetafilesTask = Promise.coroutine(function*(url,token) { return yield getMetafilesTaskRequest(url,{ token:token }); });
const getReceivers = Promise.coroutine(function*(url,token,groupId) { return yield getReceiversRequest(url,{ credentials:{ token:token }, groupMaskId:groupId }); });
const getToken = Promise.coroutine(function*(url,infoHash,auth) { return yield getTokenRequest(url,{},auth); });
const getTorrentInfo = Promise.coroutine(function*(url,infoHash,auth) { return yield getTorrentInfoRequest(url,{ infoHash:infoHash },auth); });
const getTorrentList = Promise.coroutine(function*(url,auth) { return yield getTorrentListRequest(url,{},auth); });

const getTransaction = Promise.coroutine(function*(url,site,token,groupId,channelIds,recipientIds,recipientEmails,title,encrypted,serverIdentity,fileInfo)
{
  let credentials =
  { 
    token:token,
    uuid:serverIdentity.uuid,
    hostid:serverIdentity.hostId
  };
  let transactionDesc =
  { 
    channelIds:channelIds,
    encrypted:encrypted,
    files:[ { fileName:fileInfo.path, fileSize:"" + fileInfo.size }],
    groupMaskId:groupId,
    memoTitle:title,
    recipientIds:recipientIds,
    recipientEmails:recipientEmails
  }

  let body = { credentials:credentials, transaction:transactionDesc };
  let transactionInfo =  yield getTransactionRequest(url,body);
  
  if(transactionInfo.transactions[0] == null) throw("getTransaction failed",transactionInfo);
  return transactionInfo;
});

const getTransactionStatus = Promise.coroutine(function*(url,token,transactionId) { return yield getTransactionStatusRequest(url,{ token:token, transactionId:transactionId }); });

const getTransactionHistory = Promise.coroutine(function*(url,token,hostId,fromDate,toDate)
{ 
  if(toDate != null && fromDate != null)
  {
     let fromDateString = moment(fromDate).format();
     let toDateString = moment(toDate).format();
     let body = { token:token, hostId:hostId, fromDate:fromDateString, toDate:toDateString };

     return yield getTransactionHistoryRequest(url,body);
  }
  else if(fromDate != null)
  {
     let fromDateString = moment(fromDate).format();
     let body = { token:token, hostId:hostId, fromDate:fromDateString };

     return yield getTransactionHistoryRequest(url,{ token:token, hostId:hostId, fromDate:fromDateString });
  }
  return null;
});

module.exports = function(psyHost,apiHost,website,options)
{
  let logLevel = "error";

  if(options != null && options.debug == true) logLevel = "debug";

  var logger = new (winston.Logger)({ transports: [ new winston.transports.Console({level: logLevel })]});

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

  const _completeMetafilesTask = Promise.coroutine(function*(taskId,tokenInfo)
  {
    try
    {
      if(tokenInfo == null) tokenInfo = yield _getToken();
      if(tokenInfo == null || tokenInfo.info == null || tokenInfo.info.id == null) return null;
      return yield completeMetafilesTask("https://" + apiHost + "/",tokenInfo.info.id,taskId);
    }
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

  const _getMetafilesTask = Promise.coroutine(function*(tokenInfo)
  {
    try
    {
      if(tokenInfo == null) tokenInfo = yield _getToken();
      if(tokenInfo == null || tokenInfo.info == null || tokenInfo.info.id == null) return null;
      return yield getMetafilesTask("https://" + apiHost + "/",tokenInfo.info.id);
    }
    catch(e) { return null; }
  });

  const _getReceivers = Promise.coroutine(function*(groupName,tokenInfo)
  {
    try
    {
      if(tokenInfo == null) tokenInfo = yield _getToken();

      let groupInfo = yield _findGroup(groupName,tokenInfo);

      if(groupInfo == null) return null;
      return yield getReceivers("https://" + apiHost + "/",tokenInfo.info.id,groupInfo.id);
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

  const _getTransactionForSend = Promise.coroutine(function*(group,channelName,recipientIds,recipientEmails,title,encrypted,filePath,tokenInfo)
  {
    try
    {
      if(tokenInfo == null) tokenInfo = yield _getToken();

      let serverIdentity = yield _getServerIdentity();
      let fileInfo = yield getFileInfo(filePath);
      let groupInfo = group.groupInfo;
      let channelInfo;
      let channelIds = [];

      if(groupInfo == null && group.groupName != null) groupInfo = yield _findGroup(group.groupName,tokenInfo);
      if(groupInfo == null) 
      {
        logger.error(`group ${group.groupName} not found`);
        return null;
      }
      else logger.debug(`found group ${group.groupName}`);

      let channels = yield getChannels("https://" + apiHost + "/",tokenInfo.info.id,groupInfo.id);

      if(channelName != "")
      {
        if(channels == null || channels.labelValues == null) 
        {
          logger.error("unable to obtain channel list");
          return null;
        }
        for(let i = 0;i < channels.labelValues.length;i++)
        {
           if(channels.labelValues[i].label == channelName) channelInfo = channels.labelValues[i];
        }
        if(channelInfo == null) 
        {
          logger.error(`unable to find channel ${channelName} info`);
          return null;
        }
        else logger.debug(`found info for channel ${channelName}`);
        channelIds.push(channelInfo.id);
      }
      return yield getTransaction("https://" + apiHost + "/",website,tokenInfo.info.id,groupInfo.id,channelIds,recipientIds,recipientEmails,title,encrypted,serverIdentity.identity,fileInfo);
    }
    catch(e)
    { 
      throw("transaction failed: " + e);
    }
  });

  const _getTransactionForChannelSend = Promise.coroutine(function*(groupName,channelName,title,encrypted,filePath,tokenInfo)
  {
    return _getTransactionForSend({ groupName:groupName },channelName,[],[],title,encrypted,filePath,tokenInfo);
  });

  const _getTransactionForSendToAllReceivers = Promise.coroutine(function*(groupName,title,encrypted,filePath,tokenInfo)
  {

    let groupInfo = yield _findGroup(groupName,tokenInfo);

    if(groupInfo == null) throw("group not found");

    let receivers = yield getReceivers("https://" + apiHost + "/",tokenInfo.info.id,groupInfo.id);
    let receiverIds = [];

    if(receivers == null || receivers.labelValues == null) throw("no recipients found in group");
    for(let i = 0;i < receivers.labelValues.length;i++) receiverIds.push(receivers.labelValues[i].id);

    return _getTransactionForSend({ groupInfo:groupInfo },"",receiverIds,[],title,encrypted,filePath,tokenInfo);
  });

  function lexigraphic(a,b)
  {
    if(a < b) return -1;
    else if(a > b) return 1;
    return 0;
  }

  const _getTransactionForSendToRlist = Promise.coroutine(function*(groupName,rlist,title,encrypted,filePath,tokenInfo)
  {
    let groupInfo = yield _findGroup(groupName,tokenInfo);

    if(groupInfo == null) throw("group not found");

    /*
    let receivers = yield getReceivers("https://" + apiHost + "/",tokenInfo.info.id,groupInfo.id);
    let rx = [];
    let receiverIds = [];

    if(receivers == null || receivers.labelValues == null) throw("no recipients found in group");
    for(let i = 0;i < receivers.labelValues.length;i++) 
    {
    */
    //  let email = receivers.labelValues[i].label.replace(/.*\((.*)\).*/g,'$1');
    /*
      let ref = { email:email, id:receivers.labelValues[i].id };

      rx.push(ref);
    }
    rx = rx.sort(function(a,b) { return lexigraphic(a.email,b.email); });
    rlist = rlist.sort(lexigraphic);

    let rxIndex = 0;

    for(let i = 0;i < rlist.length;i++)
    {
       while(rxIndex < rx.length && rx[rxIndex].email != rlist[i]) rxIndex++;
       if(rxIndex >= rx.length || rx[rxIndex].email != rlist[i]) throw("recipient email not found in group");
       receiverIds.push(rx[rxIndex].id);
    }
    */

    return _getTransactionForSend({ groupInfo:groupInfo },"",[],rlist,title,encrypted,filePath,tokenInfo);
  });

  const _sendToAllReceivers = Promise.coroutine(function*(groupName,title,encrypted,ignoreKeys,filePath)
  {
    let tokenInfo = yield _getToken();
    let transactionInfo = yield _getTransactionForSendToAllReceivers(groupName,title,encrypted,filePath,tokenInfo);
    let keys = [];

    if(transactionInfo.keys != null && transactionInfo.keys.length != 0 && !ignoreKeys)
    {
      for(let i = 0;i < transactionInfo.keys.length;i++) keys.push(transactionInfo.keys[i].publicKey);
    }

    return yield _addFiles([ filePath ],transactionInfo.transactions[0].transactionId,tokenInfo.info.id,keys,transactionInfo.peers);
  });

  const _sendViaChannel = Promise.coroutine(function*(groupName,channelName,title,encrypted,ignoreKeys,filePath)
  {
    let tokenInfo = yield _getToken();
    let transactionInfo = yield _getTransactionForChannelSend(groupName,channelName,title,encrypted,filePath,tokenInfo);

    if(transactionInfo != null) 
    {
      let keys = [];

      if(transactionInfo.keys != null && transactionInfo.keys.length != 0 && !ignoreKeys)
      {
        for(let i = 0;i < transactionInfo.keys.length;i++) keys.push(transactionInfo.keys[i].publicKey);
      }

      return yield _addFiles([ filePath ],transactionInfo.transactions[0].transactionId,tokenInfo.info.id,keys,transactionInfo.peers);
    }
    else 
    {
      logger.error("transaction request failed");
      return null;
    }
  });

  const _sendToRlist = Promise.coroutine(function*(groupName,rlist,title,encrypted,ignoreKeys,filePath)
  {
    let tokenInfo = yield _getToken();
    let transactionInfo = yield _getTransactionForSendToRlist(groupName,rlist,title,encrypted,filePath,tokenInfo);
    let keys = [];

    if(transactionInfo.keys != null && transactionInfo.keys.length != 0 && !ignoreKeys)
    {
      for(let i = 0;i < transactionInfo.keys.length;i++) keys.push(transactionInfo.keys[i].publicKey);
    }

    return yield _addFiles([ filePath ],transactionInfo.transactions[0].transactionId,tokenInfo.info.id,keys,transactionInfo.peers);
  });

  const _getTransactionStatus = Promise.coroutine(function*(transactionId,tokenInfo)
  {
    if(tokenInfo == null) tokenInfo = yield _getToken();

    try { return yield getTransactionStatus("https://" + apiHost + "/",tokenInfo.info.id,transactionId); }
    catch(e)
    {
      throw("failed to get transaction info: " + e);
    }
  });

  const _getTransactionHistory = Promise.coroutine(function*(fromDate,toDate,tokenInfo)
  {
    let serverIdentity = yield _getServerIdentity();

    if(tokenInfo == null) tokenInfo = yield _getToken();
    if(serverIdentity == null) throw("failed to get hostId");
    if(tokenInfo == null) throw("failed to get token");
    try
    { 
      return yield getTransactionHistory("https://" + apiHost + "/",tokenInfo.info.id,serverIdentity.identity.hostId,fromDate,toDate);
    }
    catch(e)
    {
      throw("failed to get transaction history: " + e);
    }
  });

  return {
    addFiles:_addFiles,
    checkSend:_checkSend,
    checkReceive:_checkReceive,
    completeMetafilesTask:_completeMetafilesTask,
    deleteTorrent:_deleteTorrent,
    findChannel:_findChannel,
    findGroup:_findGroup,
    getChannels:_getChannels,
    getFileInfo:getFileInfo,
    getGroups:_getGroups,
    getMetafilesTask:_getMetafilesTask,
    getReceivers:_getReceivers,
    getServerIdentity:_getServerIdentity,
    getToken:_getToken,
    getTorrentInfo:_getTorrentInfo,
    getTorrentList:_getTorrentList,
    getTransactionHistory:_getTransactionHistory,
    getTransactionStatus:_getTransactionStatus,
    sendToAllReceivers:_sendToAllReceivers,
    sendToRlist:_sendToRlist,
    sendViaChannel:_sendViaChannel
  }
};
