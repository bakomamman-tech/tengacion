const express = require("express");
const Video = require("../models/Video");
const User = require("../models/User");
const jwt = require("jsonwebtoken");

const router = express.Router();

function auth(req,res,next){
  const token = req.headers.authorization;
  if(!token) return res.status(401).json({error:"No token"});
  try{
    const d = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = d.id;
    next();
  }catch{
    res.status(401).json({error:"Invalid token"});
  }
}

/* CREATE VIDEO */
router.post("/", auth, async (req,res)=>{
  const user = await User.findById(req.userId);

  const video = await Video.create({
    userId: user._id,
    name: user.name,
    username: user.username,
    avatar: user.avatar,
    videoUrl: req.body.videoUrl,
    caption: req.body.caption || "",
    likes: [],
    comments: []
  });

  res.json(video);
});

/* GET FEED */
router.get("/", auth, async (req,res)=>{
  const vids = await Video.find().sort({time:-1});
  res.json(vids);
});

/* LIKE */
router.post("/:id/like", auth, async (req,res)=>{
  const video = await Video.findById(req.params.id);
  if(!video.likes.includes(req.userId)){
    video.likes.push(req.userId);
    await video.save();
  }
  res.json(video);
});

module.exports = router;
