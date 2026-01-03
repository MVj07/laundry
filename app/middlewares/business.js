const checkBusinessSetup = (req, res, next) => {
  if (!req.user.is_profile_completed) {
    return res.status(403).json({
      message: "Business setup not completed",
      redirect: "/setup-business",
    });
  }
  next();
};
module.exports={checkBusinessSetup}