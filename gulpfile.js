var del = require('del');
var gulp = require('gulp');
var concat = require('gulp-concat');
var filter = require('gulp-filter');
var rev = require('gulp-rev');
var inject = require('gulp-inject');
var plumber = require('gulp-plumber');
var cssmin = require('gulp-clean-css');
var sass = require('gulp-sass');
var uglify = require('gulp-uglify');
var jshint = require('gulp-jshint');

// ----------------------------
// Paths
// ----------------------------
var path = {
  js: 'client/js',
  sass: 'client/scss',
  npm: 'node_modules'
};

// ----------------------------
// Files
// ----------------------------
var files = {

  jshint: [
    'app.js',
    'gulpfile.js',
    'bin/www',
    'routes/*.js',
    'client/js/**/*.js'
  ],

  js: [
    path.npm + '/mithril/mithril.min.js',
    path.npm + '/moment/min/moment.min.js',
    path.npm + '/notifyjs/dist/notify.js',
    path.js + '/app.js',
    path.js + '/mithril/models/*.js',
    path.js + '/mithril/views/*.js'
  ],

  css: [
    path.sass + '/app.scss'
  ]

};

// ----------------------------
// Configuration
// ----------------------------
var option = {

  cssmin: {
    keepSpecialComments: 0,
    compatibility: 'ie9,-properties.zeroUnits',
    advanced: false
  },

  sass: {
    includePaths: [
      path.sass
    ],
    outputStyle: 'expanded',
    precision: 6,
    sourceComments: false,
    sourceMap: false
  },

};

// ----------------------------
// Gulp task definitions
// ----------------------------
gulp.task('default', ['inject-css', 'inject-js', 'lint']);

gulp.task('lint', function() {
  return gulp.src(files.jshint)
    .pipe(jshint())
    .pipe(jshint.reporter('jshint-stylish'));
});

gulp.task('clean-js', function() {
  return del(['public/javascripts/*']);
});

gulp.task('clean-css', function() {
  return del(['public/stylesheets/*']);
});

gulp.task('sass', ['clean-css'], function() {
  var sassFile = filter(['**', '!**/*.min.css'], {restore: true});
  return gulp.src(files.css)
    .pipe(sassFile)
    .pipe(plumber())
    .pipe(sass(option.sass))
    .pipe(plumber.stop())
    .pipe(sassFile.restore)
    .pipe(cssmin(option.cssmin))
    .pipe(concat('app.min.css'))
    .pipe(rev())
    .pipe(gulp.dest('public/stylesheets'));
});

gulp.task('js', ['clean-js'], function() {
  var unminified = filter(['**', '!**/*.min.js'], {restore: true});
  return gulp.src(files.js)
    .pipe(unminified)
    .pipe(plumber())
    .pipe(uglify())
    .pipe(plumber.stop())
    .pipe(unminified.restore)
    .pipe(concat('app.min.js'))
    .pipe(rev())
    .pipe(gulp.dest('public/javascripts'));
});

gulp.task('inject-css', ['sass'], function() {
  return gulp.src('views/includes/assets/css.pug')
    .pipe(inject(gulp.src('public/stylesheets/app-*.min.css', {read: false}), {ignorePath:'public'}))
    .pipe(gulp.dest('views/includes/build'));
});

gulp.task('inject-js', ['js'], function() {
  return gulp.src('views/includes/assets/javascript.pug')
    .pipe(inject(gulp.src('public/javascripts/app-*.min.js', {read: false}), {ignorePath:'public'}))
    .pipe(gulp.dest('views/includes/build'));
});

gulp.task('watch', ['default'], function() {
  gulp.watch(files.jshint, ['lint']);
  gulp.watch('client/scss/**/*.scss', ['inject-css']);
  gulp.watch('client/js/**/*.js', ['inject-js']);
  gulp.watch('views/includes/assets/*.pug', ['inject-js']);
});
