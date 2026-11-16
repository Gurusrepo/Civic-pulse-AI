export function createOfficerController(service) {
  return {
    list(req, res, next) {
      try { res.json(service.listIssues(req.user.id, req.validatedQuery)); } catch (error) { next(error); }
    },
    get(req, res, next) {
      try { res.json({ issue: service.getIssue(req.params.id, req.user.id) }); } catch (error) { next(error); }
    },
    start(req, res, next) {
      try { res.status(200).json({ event: service.startWork(req.params.id, req.user.id) }); } catch (error) { next(error); }
    },
    async upload(req, res, next) {
      try {
        const evidence = await service.uploadEvidence(req.params.id, req.user.id, req.body.stage, req.file);
        res.status(201).json({ evidence });
      } catch (error) { next(error); }
    },
    async evidence(req, res, next) {
      try { res.json({ items: await service.listEvidence(req.params.id, req.user.id) }); } catch (error) { next(error); }
    },
    complete(req, res, next) {
      try { res.json({ event: service.completeWork(req.params.id, req.user.id) }); } catch (error) { next(error); }
    }
  };
}
