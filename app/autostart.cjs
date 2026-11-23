// Launch-at-login is on by default: the installed app turns it on once, the first time it runs,
// and from then on the switch in Settings is the user's to change.

// The portable build runs from a temporary copy, so it registers the original exe instead.
function loginOptions(env=process.env) {
  return env.PORTABLE_EXECUTABLE_FILE?{path:env.PORTABLE_EXECUTABLE_FILE}:{};
}

function needsDefaultLogin(state,packaged) {
  return Boolean(packaged&&!state.loginDefaultApplied);
}

module.exports={loginOptions,needsDefaultLogin};
