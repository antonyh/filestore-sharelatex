const settings = require('settings-sharelatex')

module.exports = {
  getConvertedFolderKey (key) {
    return (key = `${key}-converted-cache/`)
  },

  addCachingToKey (key, { format, style }) {
    key = this.getConvertedFolderKey(key)
    if (format != null && style == null) {
      key = `${key}format-${format}`
    }
    if (style != null && format == null) {
      key = `${key}style-${style}`
    }
    if (style != null && format != null) {
      key = `${key}format-${format}-style-${style}`
    }
    return key
  },

  userFileKey (req, res, next) {
    const { project_id, file_id } = req.params
    req.key = `${project_id}/${file_id}`
    req.bucket = settings.filestore.stores.user_files
    return next()
  },

  publicFileKey (req, res, next) {
    const { project_id, public_file_id } = req.params
    if (settings.filestore.stores.public_files == null) {
      return res.status(501).send('public files not available')
    } else {
      req.key = `${project_id}/${public_file_id}`
      req.bucket = settings.filestore.stores.public_files
      return next()
    }
  },

  templateFileKey (req, res, next) {
    const { template_id, format, version, sub_type } = req.params
    req.key = `${template_id}/v/${version}/${format}`
    if (sub_type != null) {
      req.key = `${req.key}/${sub_type}`
    }
    req.bucket = settings.filestore.stores.template_files
    req.version = version
    const opts = req.query
    return next()
  },

  publicProjectKey (req, res, next) {
    const { project_id } = req.params
    req.project_id = project_id
    req.bucket = settings.filestore.stores.user_files
    return next()
  },
}
