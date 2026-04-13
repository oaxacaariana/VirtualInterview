/**
 * Home page controller.
 * Inputs: Express request and response objects.
 * Outputs: Renders the public home page.
 */
const showHomePage = (req, res) => {
  res.render('home');
};

module.exports = { showHomePage };
