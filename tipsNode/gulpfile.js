'use strict';
 
var gulp = require('gulp'),
    clean = require('gulp-clean');
    sourcemaps = require('gulp-sourcemaps');    
    uglify = require('gulp-uglify');

 
var path = {
    build: {},
    src: {
        css: 'src/styles/'
    },
    watch: {},
    clean: ['build', 'src/styles/style.css']
};
 
gulp.task('clean', function() {
    return gulp.src(path.clean, {read: false})
        .pipe(clean());
});

// gulp.task('sass', function() {
//     return gulp.src(path.src.sass)

//         .pipe(sourcemaps.init())
//         .pipe(sass())

//         .pipe(sourcemaps.write())
//         .pipe(gulp.dest(path.src.css));
// });