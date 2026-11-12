;(function () {
  function closeMenu(event) {
    const drawer = document.querySelector('.cn-site-drawer[open]')
    if (!drawer) return
    if (event.type === 'keydown') {
      if (event.key !== 'Escape') return
      drawer.open = false
      drawer.querySelector('summary').focus()
    } else if (!drawer.contains(event.target) || event.target.closest('a')) {
      drawer.open = false
    }
  }
  document.addEventListener('keydown', closeMenu)
  document.addEventListener('click', closeMenu)
})()
