CXXFLAGS = -O3 -std=c++11 -lglfw -ltbb -lglew -llo -framework OpenGL -DENABLE_OSC

.PHONY: all
all: renderer offline

.PHONY: wasm
wasm: sampler_wasm.js

.PHONY: clean
clean:
	rm renderer
	rm sampler_wasm.js

renderer: $(wildcard *.cpp) $(wildcard *.h) makefile
	g++ main.cpp renderer.cpp fractal.cpp sampler.cpp colormaps.cpp -o renderer $(CXXFLAGS)

offline: $(wildcard *.cpp) $(wildcard *.h) makefile
	g++ offline.cpp renderer.cpp fractal.cpp sampler.cpp colormaps.cpp -o offline $(CXXFLAGS)

sampler_wasm.js: sampler.cpp sampler.h
	emcc -std=c++11 \
		-s WASM=1 \
		-s MODULARIZE=1 \
		-s NO_FILESYSTEM=1 \
		-s "EXTRA_EXPORTED_RUNTIME_METHODS=[\"cwrap\"]" \
		-s ALLOW_MEMORY_GROWTH=1 \
		-s SINGLE_FILE=1 \
		-O3 sampler.cpp -o sampler_wasm.js
