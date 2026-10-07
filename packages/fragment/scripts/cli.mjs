#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {parse,assertValid,exportModel,ast,evaluate,unresolved} from '../src/core.js';
try{
 const [command='validate',path,extra,target='screen']=process.argv.slice(2);
 const model=assertValid(parse(readFileSync(path||0,'utf8')));
 switch(command){
 case 'validate':console.log(JSON.stringify({valid:true,unresolved:unresolved(model)}));break;
 case 'json':case 'yaml':process.stdout.write(exportModel(model,command));break;
 case 'ast':console.log(JSON.stringify(ast(model),null,2));break;
 case 'evaluate':if(!['screen','print'].includes(target))throw Error('Target must be screen or print');console.log(JSON.stringify(evaluate(model,JSON.parse(readFileSync(extra,'utf8')),target),null,2));break;
 case 'bind':model.bindings=JSON.parse(readFileSync(extra,'utf8'));process.stdout.write(exportModel(model,'json'));break;
 default:throw Error('Commands: validate | json | yaml | ast | evaluate | bind');
 }
}catch(e){console.error(e.message);process.exitCode=1;}
