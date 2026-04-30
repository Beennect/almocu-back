#!/bin/bash

# Configuration
MODULES_DIR="modules"
STOCK_REPO="git@github.com:Beennect/stock.git"
MENU_REPO="git@github.com:Beennect/menu.git"

# Create modules directory if not present
if [ ! -d "$MODULES_DIR" ]; then
    echo "Creating $MODULES_DIR directory..."
    mkdir -p "$MODULES_DIR"
fi

# Function to clone or pull
setup_module() {
    local repo_url=$1
    local module_name=$2
    local module_path="$MODULES_DIR/$module_name"

    if [ ! -d "$module_path" ]; then
        echo "Cloning $module_name from $repo_url..."
        git clone "$repo_url" "$module_path"
    else
        echo "Module $module_name already exists. Pulling latest changes..."
        # You can uncomment the lines below to auto-pull if you prefer
        # cd "$module_path"
        # git pull origin main
        # cd ../..
    fi
}

echo "=== Almoco Auth Shared Setup ==="
setup_module "$STOCK_REPO" "stock"
setup_module "$MENU_REPO" "menu"

echo "-----------------------------------"
echo "Setup is complete!"
echo "To start all services (almoco_auth, stock, menu), run:"
echo "docker compose -f docker-compose.all.yaml up --build -d"
echo ""
echo "Ports mapping:"
echo "- auth-app: 3000"
echo "- stock-app: 3100"
echo "- menu-app: 3200"
echo "- zitadel: 8080"
echo "-----------------------------------"
