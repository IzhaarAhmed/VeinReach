import * as meetupService from '../services/meetup.service.js';
import { ok, created, asyncHandler } from '../utils/response.js';

export const create = asyncHandler(async (req, res) => {
  const meetup = await meetupService.createMeetup(req.user.id, req.body);
  created(res, { meetup }, 'Meetup invite sent to donor');
});

export const respond = asyncHandler(async (req, res) => {
  const meetup = await meetupService.respondMeetup(req.user.id, req.params.id, req.body.accept);
  ok(res, { meetup }, `Invite ${meetup.status}`);
});

export const mine = asyncHandler(async (req, res) => {
  const meetups = await meetupService.myMeetups(req.user.id);
  ok(res, { meetups }, 'My meetups');
});
