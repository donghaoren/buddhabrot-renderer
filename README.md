Buddhabrot Renderer
====

A realtime [Buddhabrot](https://en.wikipedia.org/wiki/Buddhabrot) fractal renderer. Two versions are implemented here:

- Browser version based on WebGL 2 and transform feedback.
- Native version using OpenGL 3.3 and geometry shader.

[Live Demo Here](https://donghaoren.org/buddhabrot/)

![Gallery Image](https://raw.githubusercontent.com/donghaoren/buddhabrot-renderer/master/images/gallery.jpg)

[Demo Video](https://vimeo.com/266017672)

Build WebGL Version
----

```bash
# Install dependencies first:
npm install

# Build the WebGL version
npm run build
```

Open `index.html` and enjoy.

Watch development:

```bash
npm run watch
```

Build Native Version
----

```bash
# Install native dependencies (here for Mac OS X)
brew install glfw
brew install glew
brew install liblo

# Build with the makefile under "native"
cd native
make

# Run it with
./renderer
```

**OSC Control:** The native version receive its parameters via the OSC protocol.
`osc_example.js` is a sample for how to send messages to it.

References
----

The colormaps used in this project are from these sources:

- Dave Green's [Cubehelix colour scheme](http://www.mrao.cam.ac.uk/~dag/CUBEHELIX/)
- Peter Karpov's article [In Search of a Perfect Colormap](http://inversed.ru/Blog_2.htm)

Melinda Green's [The Buddhabrot Technique](http://superliminal.com/fractals/bbrot/bbrot.htm) contains a lot of useful links to the buddhabrot method.

License
----

```
Copyright 2018 Donghao Ren

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to
do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```
