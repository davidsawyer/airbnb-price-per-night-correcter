const autoprefixer = require('gulp-autoprefixer'),
    del = require('del'),
    gulp = require('gulp'),
    runSequence = require('run-sequence'),
    zip = require('gulp-zip')

const temp = 'temp-wrapper-folder'

const paths = {
    styles: [
        'css/*.css'
    ],
    indexScripts: [
        'node_modules/jquery/dist/jquery.js',
        'js/index.js'
    ],
    destination: 'dist'
}

gulp.task('css', () =>
    gulp.src(paths.styles)
        .pipe(autoprefixer({ browsers: [
            'last 10 Chrome versions',
            'last 10 Firefox versions'
        ] }))
        .pipe(gulp.dest(paths.destination))
)

gulp.task('scripts', () =>
    gulp.src(paths.indexScripts)
        .pipe(gulp.dest(paths.destination))
)

gulp.task('wrap', () =>
    gulp.src(['dist/**'])
        .pipe(gulp.dest(`${temp}/dist`))
)

gulp.task('zip', () =>
    gulp.src([`${temp}/**/*`, 'manifest.json'])
        .pipe(zip('upload-me-to-the-browser-web-stores.zip'))
        .pipe(gulp.dest('.'))
)

gulp.task('clean', () =>
    del([`${temp}/**`])
)

gulp.task('watch', () => {
    gulp.watch(paths.indexScripts, ['scripts'])
    gulp.watch(paths.styles, ['css'])
})

gulp.task('default', ['scripts', 'css', 'watch'])
gulp.task('prod', callback => runSequence(['scripts', 'css'], 'wrap', 'zip', 'clean', callback))
