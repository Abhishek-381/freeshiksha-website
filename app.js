const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    req.flash("error_msg", "Please log in first!");
    res.redirect("/login");
};

module.exports = {isAuthenticated}