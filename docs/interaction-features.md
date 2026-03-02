# Interaction Features API + Socket Events

## New/Updated REST Endpoints

### Stories
- `POST /api/stories` body supports `visibility` (`public|friends|close_friends`)
- `GET /api/stories/feed`
- `POST /api/stories/:id/react` `{ emoji }`
- `POST /api/stories/:id/reply` `{ text }`

### Status / Mood
- `PUT /api/users/me/status` `{ text, emoji }`
- `GET /api/users/:id/status`

### Close Friends
- `GET /api/users/me/close-friends`
- `PUT /api/users/me/close-friends` `{ add: string[], remove: string[] }`

### Streak + Check-in
- `POST /api/checkin` `{ text }`
- `GET /api/users/me/streaks`

### Posts (poll/quiz/comments)
- `POST /api/posts` supports `type: poll|quiz|checkin`, `poll`, `quiz`, `visibility`
- `POST /api/posts/:id/poll/vote` `{ optionId }`
- `POST /api/posts/:id/quiz/answer` `{ optionId }`
- `POST /api/posts/:id/comments` `{ text, parentCommentId? }`
- `GET /api/posts/:id/comments?threaded=true`

### Message reactions
- `POST /api/messages/:messageId/react` `{ emoji }`

### Community Rooms
- `POST /api/rooms`
- `GET /api/rooms`
- `POST /api/rooms/:id/join`
- `POST /api/rooms/:id/leave`
- `GET /api/rooms/:id/feed`
- `GET /api/rooms/:id/messages`
- `POST /api/rooms/:id/messages`

## Socket Events

### Chat interaction signals
- `chat:typing` `{ chatId, toUserId, isTyping }`
- `chat:recording` `{ chatId, toUserId, isRecording }`
- `message:react` `{ messageId, emoji }`
- server -> `message:reaction` `{ messageId, reactions }`

### Watch Together
- `watch:join` `{ chatId }`
- `watch:state` `{ chatId, videoUrl, t, isPlaying }`
- `watch:play` `{ chatId, t }`
- `watch:pause` `{ chatId, t }`
- `watch:seek` `{ chatId, t }`

### Community Rooms
- `room:join` `{ roomId }`
- server -> `room:message`

## Birthday Recognition
- Automated hourly scan on backend start (`runBirthdayRecognition`)
- Creates:
  - system `Message` with `metadata.type = "birthday"` and cake image payload
  - system `Notification`
- Cake asset path: `/assets/birthday-cake.svg`
