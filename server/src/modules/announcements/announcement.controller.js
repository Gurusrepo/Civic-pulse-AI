import * as announcementService from './announcement.service.js';

export function list(req, res, next) {
  try {
    res.json(announcementService.listAnnouncements(req.validatedQuery));
  } catch (error) { next(error); }
}

export function get(req, res, next) {
  try {
    const announcement = announcementService.getAnnouncement(req.params.id);
    if (!announcement) return res.status(404).json({ error: 'Announcement not found' });
    res.json({ announcement });
  } catch (error) { next(error); }
}

export function publish(req, res, next) {
  try {
    res.status(201).json({
      announcement: announcementService.publishAnnouncement(req.user.id, req.body)
    });
  } catch (error) { next(error); }
}
