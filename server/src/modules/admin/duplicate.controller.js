import * as service from './duplicate.service.js';
export function list(req,res,next){ try { res.json(service.listDuplicateCandidates(req.validatedQuery)); } catch(e){next(e);} }
export async function assess(req,res,next){ try { res.json({suggestion:await service.assessDuplicate(req.params.id,req.user.id)}); } catch(e){next(e);} }
export function approve(req,res,next){ try { res.json({grouping:service.approveDuplicate(req.params.id,req.body.canonicalIssueId,req.user.id)}); } catch(e){next(e);} }
export function reject(req,res,next){ try { res.json({suggestion:service.rejectDuplicate(req.params.id,req.body.reason,req.user.id)}); } catch(e){next(e);} }
