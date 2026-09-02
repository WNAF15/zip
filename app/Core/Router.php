<?php

namespace App\Core;

class Router
{
    private $routes = [];

    public function get($uri, $callback)
    {
        $this->routes['GET'][$uri] = $callback;
    }

    public function post($uri, $callback)
    {
        $this->routes['POST'][$uri] = $callback;
    }

    public function dispatch($uri, $method)
    {
        $uri = strtok($uri, '?');
        
        // 1. Проверяем точное совпадение
        if (isset($this->routes[$method][$uri])) {
            $callback = $this->routes[$method][$uri];
            if (is_callable($callback)) {
                echo $callback();
            } elseif (is_array($callback)) {
                $controller = new $callback[0]();
                $action = $callback[1];
                echo $controller->$action();
            }
            return;
        }
        
        // 2. Проверяем маршруты с параметрами (любое имя: {id}, {slug}, {name})
        foreach ($this->routes[$method] as $route => $callback) {
            // Ищем любой параметр в фигурных скобках
            if (preg_match('/\{[a-zA-Z_]+\}/', $route)) {
                // Превращаем {slug} или {id} в регулярное выражение
                $pattern = preg_replace('/\{[a-zA-Z_]+\}/', '([^/]+)', $route);
                $pattern = '#^' . $pattern . '$#';
                
                if (preg_match($pattern, $uri, $matches)) {
                    // Первый захваченный параметр — это значение (slug или id)
                    $param = $matches[1];
                    
                    if (is_callable($callback)) {
                        echo $callback($param);
                    } elseif (is_array($callback)) {
                        $controller = new $callback[0]();
                        $action = $callback[1];
                        echo $controller->$action($param);
                    }
                    return;
                }
            }
        }
        
        http_response_code(404);
        echo "404 - Страница не найдена";
    }
}