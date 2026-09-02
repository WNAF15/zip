<?php

namespace App\Core;

class View
{
    public static function render($view, $data = [])
    {
        extract($data, EXTR_SKIP);
        $viewPath = __DIR__ . "/../Views/{$view}.php";
        if (!file_exists($viewPath)) {
            throw new \Exception("View {$view} not found");
        }

        ob_start();
        include $viewPath;
        $content = ob_get_clean();

        $layoutPath = __DIR__ . "/../Views/layouts/main.php";
        if (file_exists($layoutPath)) {
            include $layoutPath;
        } else {
            echo $content;
        }
    }

    /**
     * Render a standalone view which already owns its full HTML document.
     * This is used by the authentication screens and intentionally skips
     * the main site layout/navigation.
     */
    public static function renderStandalone($view, $data = [])
    {
        extract($data, EXTR_SKIP);
        $viewPath = __DIR__ . "/../Views/{$view}.php";
        if (!file_exists($viewPath)) {
            throw new \Exception("View {$view} not found");
        }
        include $viewPath;
    }
}
