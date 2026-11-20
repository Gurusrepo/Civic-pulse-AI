import * as announcementService from './announcement.service.js';

export function list(req, res, next) {
  try {
    res.json(announcementService.listAnnouncements(req.validatedQuery));
  } catch (error) {
    next(error);
  }
}

export function get(req, res, next) {
  try {
    const announcement = announcementService.getAnnouncement(req.params.id);
    if (!announcement) return res.status(404).json({ error: 'Announcement not found' });
    res.json({ announcement });
  } catch (error) {
    next(error);
  }
}

export function listAdmin(req, res, next) {
  try {
    res.json(announcementService.listAdminAnnouncements(req.validatedQuery));
  } catch (error) {
    next(error);
  }
}

export function getAdmin(req, res, next) {
  try {
    const announcement = announcementService.getAdminAnnouncement(req.params.id);
    if (!announcement) return res.status(404).json({ error: 'Announcement not found' });
    res.json({ announcement });
  } catch (error) {
    next(error);
  }
}

export function create(req, res, next) {
  try {
    res.status(201).json({
      announcement: announcementService.createAnnouncement(req.user.id, req.body)
    });
  } catch (error) {
    next(error);
  }
}

export function update(req, res, next) {
  try {
    const announcement = announcementService.updateAnnouncement(req.params.id, req.body);
    if (!announcement) return res.status(404).json({ error: 'Announcement not found' });
    res.json({ announcement });
  } catch (error) {
    next(error);
  }
}

export function setPublication(req, res, next) {
  try {
    const announcement = announcementService.setAnnouncementPublication(
      req.params.id,
      req.body.isPublished
    );
    if (!announcement) return res.status(404).json({ error: 'Announcement not found' });
    res.json({ announcement });
  } catch (error) {
    next(error);
  }
}

export function remove(req, res, next) {
  try {
    const deleted = announcementService.deleteAnnouncement(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Announcement not found' });
    res.json({ deleted: true });
  } catch (error) {
    next(error);
  }
}
